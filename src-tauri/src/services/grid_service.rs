//! Table-data browse + staged-edit commit — the editable-grid surface. Per the
//! v1 rule, editing is only ever the *table data view* (a known table), never an
//! arbitrary query result, so provenance is never guessed.
//!
//! Row identity is the primary key, or (fallback, no PK) every non-binary column.
//! The commit runs as one transaction in the driver; this service resolves the
//! table's columns/types, validates the edits, and picks the identity.

use std::collections::HashMap;

use crate::drivers::types::{BrowseResult, CellValue, Engine, GridCommitResult, GridEdit};
use crate::services::connection_service::{session_driver, SessionRegistry};
use crate::sqlgen::{quote_ident, quote_qualified, Statement};
use crate::{AppError, AppResult};

/// Same buffered window as any query (spec: no server-side paging in v1).
const DEFAULT_ROW_LIMIT: usize = 500;

/// Loads the editable table-data view: a `limit + 1` window plus the row-identity
/// the grid echoes back on edit. Columns come from `describe_table` (authoritative
/// PK/nullable/type), not the result set.
pub async fn browse(
    session_id: &str,
    namespace: &str,
    table: &str,
    limit: Option<usize>,
    registry: &SessionRegistry,
) -> AppResult<BrowseResult> {
    let (driver, _read_only) = session_driver(session_id, registry).await?;
    let engine = driver.engine();
    let desc = driver.describe_table(namespace, table).await?;

    let limit = limit.unwrap_or(DEFAULT_ROW_LIMIT);
    let column_names = desc.columns.iter().map(|c| c.name.as_str());
    let sql = browse_sql(engine, namespace, table, column_names, limit);
    let stmt = Statement {
        start: 0,
        end: sql.len(),
        text: sql.clone(),
    };

    let mut results = driver.run(std::slice::from_ref(&stmt), limit).await?;
    let result = results
        .pop()
        .ok_or_else(|| AppError::internal("browse returned no result"))?;
    if let Some(err) = result.error {
        return Err(AppError::QueryError {
            message: err.message,
            detail: err.detail,
        });
    }

    let pk: Vec<String> = desc
        .columns
        .iter()
        .filter(|c| c.is_pk)
        .map(|c| c.name.clone())
        .collect();
    let (key_columns, key_is_fallback) = if pk.is_empty() {
        // Fallback identity: every non-binary column (binary can't be equated).
        let ids = desc
            .columns
            .iter()
            .filter(|c| !is_binaryish(&c.type_name))
            .map(|c| c.name.clone())
            .collect::<Vec<_>>();
        (ids, true)
    } else {
        (pk, false)
    };
    let editable = !key_columns.is_empty();
    let not_editable_reason =
        (!editable).then(|| "table has no primary key and no usable row identity".to_string());

    Ok(BrowseResult {
        columns: desc.columns,
        rows: result.rows,
        truncated: result.truncated,
        key_columns,
        key_is_fallback,
        editable,
        not_editable_reason,
        sql,
        duration_ms: result.duration_ms,
    })
}

/// Applies staged edits transactionally. Validates columns exist and are editable
/// (binary/`Unknown` cells are read-only in v1), then hands off to the driver.
pub async fn commit(
    session_id: &str,
    namespace: &str,
    table: &str,
    key_columns: Vec<String>,
    edits: Vec<GridEdit>,
    registry: &SessionRegistry,
) -> AppResult<GridCommitResult> {
    let (driver, read_only) = session_driver(session_id, registry).await?;
    if read_only {
        return Err(AppError::ReadOnlyViolation(
            "connection is read-only".into(),
        ));
    }
    if edits.is_empty() {
        return Ok(GridCommitResult { rows_affected: 0 });
    }

    let desc = driver.describe_table(namespace, table).await?;
    let types: HashMap<String, String> = desc
        .columns
        .iter()
        .map(|c| (c.name.clone(), c.type_name.clone()))
        .collect();

    for edit in &edits {
        for change in edit.columns() {
            if !types.contains_key(&change.column) {
                return Err(AppError::internal(format!(
                    "unknown column '{}'",
                    change.column
                )));
            }
            if matches!(change.value, CellValue::Bytes(_) | CellValue::Unknown(_)) {
                return Err(AppError::ReadOnlyViolation(format!(
                    "column '{}' holds a binary/unknown value and is read-only",
                    change.column
                )));
            }
        }
    }

    let needs_key = edits
        .iter()
        .any(|e| matches!(e, GridEdit::Update { .. } | GridEdit::Delete { .. }));
    if needs_key && key_columns.is_empty() {
        return Err(AppError::NoPrimaryKey(format!(
            "'{table}' has no primary key; cannot target rows for update or delete"
        )));
    }

    driver
        .commit_grid(namespace, table, &key_columns, &types, &edits)
        .await
}

/// The canonical table-browse statement: an explicit column list (so result order
/// matches the described metadata) and the row cap.
///
/// The `LIMIT` stays in the SQL — it is what stops the engine from scanning and
/// streaming the whole table; the fetch-side cap only bounds decoding. Asking for
/// `limit + 1` rows is also how truncation is detected.
fn browse_sql<'a>(
    engine: Engine,
    namespace: &str,
    table: &str,
    columns: impl Iterator<Item = &'a str>,
    limit: usize,
) -> String {
    let cols = columns
        .map(|name| quote_ident(engine, name))
        .collect::<Vec<_>>()
        .join(", ");
    let qualified = quote_qualified(engine, namespace, table);
    format!("SELECT {cols} FROM {qualified} LIMIT {}", limit + 1)
}

/// Heuristic: a column whose type can't participate in an equality-based identity.
fn is_binaryish(type_name: &str) -> bool {
    let t = type_name.to_ascii_lowercase();
    t.contains("bytea") || t.contains("blob") || t.contains("binary")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::connections::ConnectionProfile;
    use crate::drivers::types::{CellChange, Engine};
    use crate::services::connection_service;
    use std::collections::HashMap;
    use tokio::sync::Mutex;

    /// A fresh SQLite session seeded with `setup` DDL/DML (created via a throwaway
    /// pool, mirroring the query-service tests).
    async fn session(setup: &[&str]) -> (String, SessionRegistry) {
        use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
        let path = std::env::temp_dir()
            .join(format!("basalt-grid-{}.db", uuid::Uuid::new_v4()))
            .to_string_lossy()
            .into_owned();
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(
                SqliteConnectOptions::new()
                    .filename(&path)
                    .create_if_missing(true),
            )
            .await
            .unwrap();
        for stmt in setup {
            sqlx::query(sqlx::AssertSqlSafe(stmt.to_string()))
                .execute(&pool)
                .await
                .unwrap();
        }
        pool.close().await;

        let profile = ConnectionProfile {
            id: "g".into(),
            name: "g".into(),
            engine: Engine::Sqlite,
            environment: None,
            host: None,
            port: None,
            database: None,
            username: None,
            file_path: Some(path),
            read_only: false,
            connect_timeout_secs: Some(5),
            secret_ref: None,
            tls: None,
            ssh: None,
        };
        let registry: SessionRegistry = Mutex::new(HashMap::new());
        let info = connection_service::connect(&profile, None, &registry)
            .await
            .unwrap();
        (info.session_id, registry)
    }

    #[test]
    fn browse_sql_quotes_identifiers_per_engine() {
        let cols = || ["id", "we\"ird", "ba`ck"].into_iter();

        assert_eq!(
            browse_sql(Engine::Postgres, "public", "od\"d", cols(), 500),
            r#"SELECT "id", "we""ird", "ba`ck" FROM "public"."od""d" LIMIT 501"#
        );
        assert_eq!(
            browse_sql(Engine::Sqlite, "main", "od\"d", cols(), 500),
            r#"SELECT "id", "we""ird", "ba`ck" FROM "main"."od""d" LIMIT 501"#
        );
        // MySQL backtick-quotes and doubles embedded backticks; a `"` is inert.
        assert_eq!(
            browse_sql(Engine::MySql, "app", "ba`d", cols(), 10),
            r#"SELECT `id`, `we"ird`, `ba``ck` FROM `app`.`ba``d` LIMIT 11"#
        );
    }

    fn change(column: &str, value: CellValue) -> CellChange {
        CellChange {
            column: column.into(),
            value,
        }
    }

    #[tokio::test]
    async fn pk_roundtrip_insert_update_delete() {
        let (sid, reg) = session(&[
            "CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT, n INT)",
            "INSERT INTO t (id, name, n) VALUES (1, 'a', 10), (2, 'b', 20)",
        ])
        .await;

        let b = browse(&sid, "main", "t", None, &reg).await.unwrap();
        assert_eq!(b.key_columns, ["id"]);
        assert!(!b.key_is_fallback && b.editable);
        assert_eq!(b.rows.len(), 2);

        let edits = vec![
            GridEdit::Update {
                key: vec![CellValue::Int(1)],
                set: vec![change("name", CellValue::Text("A".into()))],
            },
            GridEdit::Insert {
                set: vec![
                    change("id", CellValue::Int(3)),
                    change("name", CellValue::Text("c".into())),
                ],
            },
            GridEdit::Delete {
                key: vec![CellValue::Int(2)],
            },
        ];
        let res = commit(&sid, "main", "t", vec!["id".into()], edits, &reg)
            .await
            .unwrap();
        assert_eq!(res.rows_affected, 3);

        let after = browse(&sid, "main", "t", None, &reg).await.unwrap();
        assert!(after
            .rows
            .iter()
            .any(|r| r[0] == CellValue::Int(1) && r[1] == CellValue::Text("A".into())));
        assert!(after.rows.iter().any(|r| r[0] == CellValue::Int(3)));
        assert!(!after.rows.iter().any(|r| r[0] == CellValue::Int(2)));
    }

    #[tokio::test]
    async fn no_pk_fallback_and_ambiguous_rollback() {
        let (sid, reg) = session(&[
            "CREATE TABLE t (a INT, b TEXT)",
            "INSERT INTO t (a, b) VALUES (1, 'x'), (1, 'x'), (2, 'y')",
        ])
        .await;

        let b = browse(&sid, "main", "t", None, &reg).await.unwrap();
        assert!(b.key_is_fallback && b.editable);
        assert_eq!(b.key_columns, ["a", "b"]);

        // (1,'x') is duplicated → matches 2 rows → ambiguous, whole batch rolls back.
        let bad = GridEdit::Update {
            key: vec![CellValue::Int(1), CellValue::Text("x".into())],
            set: vec![change("b", CellValue::Text("z".into()))],
        };
        let err = commit(
            &sid,
            "main",
            "t",
            vec!["a".into(), "b".into()],
            vec![bad],
            &reg,
        )
        .await
        .unwrap_err();
        assert_eq!(err.kind(), "ambiguousRowIdentity");
        assert_eq!(err.detail().unwrap()["index"], 0);

        let after = browse(&sid, "main", "t", None, &reg).await.unwrap();
        assert!(!after
            .rows
            .iter()
            .any(|r| r[1] == CellValue::Text("z".into())));

        // A unique fallback identity (2,'y') updates exactly one row.
        let ok = GridEdit::Update {
            key: vec![CellValue::Int(2), CellValue::Text("y".into())],
            set: vec![change("b", CellValue::Text("Y".into()))],
        };
        commit(
            &sid,
            "main",
            "t",
            vec!["a".into(), "b".into()],
            vec![ok],
            &reg,
        )
        .await
        .unwrap();
        let done = browse(&sid, "main", "t", None, &reg).await.unwrap();
        assert!(done
            .rows
            .iter()
            .any(|r| r[0] == CellValue::Int(2) && r[1] == CellValue::Text("Y".into())));
    }

    #[tokio::test]
    async fn null_identity_matches_via_is_null() {
        let (sid, reg) = session(&[
            "CREATE TABLE t (a INT, b TEXT)",
            "INSERT INTO t (a, b) VALUES (1, NULL)",
        ])
        .await;
        let edit = GridEdit::Update {
            key: vec![CellValue::Int(1), CellValue::Null],
            set: vec![change("b", CellValue::Text("filled".into()))],
        };
        commit(
            &sid,
            "main",
            "t",
            vec!["a".into(), "b".into()],
            vec![edit],
            &reg,
        )
        .await
        .unwrap();
        let after = browse(&sid, "main", "t", None, &reg).await.unwrap();
        assert_eq!(after.rows[0][1], CellValue::Text("filled".into()));
    }

    #[tokio::test]
    async fn browse_returns_the_statement_that_ran() {
        let (sid, reg) = session(&[
            r#"CREATE TABLE "od""d" (id INTEGER PRIMARY KEY, "we""ird" TEXT)"#,
            r#"INSERT INTO "od""d" VALUES (1, 'x')"#,
        ])
        .await;

        let b = browse(&sid, "main", r#"od"d"#, Some(2), &reg)
            .await
            .unwrap();
        // SQLite (like Postgres) double-quotes identifiers, doubling embedded quotes.
        assert_eq!(
            b.sql,
            r#"SELECT "id", "we""ird" FROM "main"."od""d" LIMIT 3"#
        );
        assert_eq!(b.rows.len(), 1);
        assert!(!b.truncated);
    }

    /// The row cap must stay in the SQL: it is what stops the engine scanning the
    /// whole table, and the `limit + 1`th row is what marks the page truncated.
    #[tokio::test]
    async fn browse_caps_rows_in_sql_and_flags_truncation() {
        let (sid, reg) = session(&[
            "CREATE TABLE t (id INTEGER PRIMARY KEY)",
            "INSERT INTO t VALUES (1), (2), (3), (4)",
        ])
        .await;

        let b = browse(&sid, "main", "t", Some(2), &reg).await.unwrap();
        assert_eq!(b.sql, r#"SELECT "id" FROM "main"."t" LIMIT 3"#);
        assert_eq!(b.rows.len(), 2);
        assert!(b.truncated);
    }

    #[tokio::test]
    async fn browse_of_an_empty_table_still_describes_it() {
        let (sid, reg) = session(&["CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT)"]).await;

        let b = browse(&sid, "main", "t", None, &reg).await.unwrap();
        assert_eq!(b.columns.len(), 2);
        assert!(b.rows.is_empty());
        assert_eq!(b.sql, r#"SELECT "id", "name" FROM "main"."t" LIMIT 501"#);
    }

    #[tokio::test]
    async fn missing_pk_blocks_update() {
        let (sid, reg) = session(&["CREATE TABLE t (a INT)", "INSERT INTO t VALUES (1)"]).await;
        // An update with no key columns must be refused, not run WHERE-less.
        let edit = GridEdit::Update {
            key: vec![],
            set: vec![change("a", CellValue::Int(9))],
        };
        let err = commit(&sid, "main", "t", vec![], vec![edit], &reg)
            .await
            .unwrap_err();
        assert_eq!(err.kind(), "noPrimaryKey");
    }
}
