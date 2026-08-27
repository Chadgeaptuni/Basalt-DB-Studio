//! CSV import: parse the file, map fields to the target columns, and hand the rows
//! to the driver's transactional conflict-INSERT. Empty fields become SQL NULL. The
//! CSV parser is a small RFC4180 state machine (quotes, embedded commas/newlines,
//! `""` escaping) — no serialization crate.

use std::collections::HashMap;

use crate::drivers::types::{CellValue, ConflictMode, ImportResult};
use crate::services::connection_service::{session_driver, SessionRegistry};
use crate::{AppError, AppResult};

#[allow(clippy::too_many_arguments)]
pub async fn import(
    session_id: &str,
    namespace: &str,
    table: &str,
    columns: Vec<String>,
    has_header: bool,
    conflict: ConflictMode,
    path: &str,
    registry: &SessionRegistry,
) -> AppResult<ImportResult> {
    let (driver, read_only) = session_driver(session_id, registry).await?;
    if read_only {
        return Err(AppError::ReadOnlyViolation(
            "connection is read-only".into(),
        ));
    }
    if columns.is_empty() {
        return Err(AppError::internal("no target columns selected"));
    }

    let text = std::fs::read_to_string(path).map_err(|e| AppError::ImportParse {
        message: format!("cannot read file: {e}"),
        line: 0,
    })?;
    let records = parse_csv(&text);
    let start = if has_header { 1 } else { 0 };
    if records.len() <= start {
        return Ok(ImportResult { inserted: 0 });
    }

    let desc = driver.describe_table(namespace, table).await?;
    let types: HashMap<String, String> = desc
        .columns
        .iter()
        .map(|c| (c.name.clone(), c.type_name.clone()))
        .collect();
    for c in &columns {
        if !types.contains_key(c) {
            return Err(AppError::internal(format!("unknown column '{c}'")));
        }
    }
    let pk: Vec<String> = desc
        .columns
        .iter()
        .filter(|c| c.is_pk)
        .map(|c| c.name.clone())
        .collect();

    // Each field → Text, or NULL when empty (the common CSV convention in v1).
    let mut rows = Vec::with_capacity(records.len() - start);
    for (idx, rec) in records.iter().enumerate().skip(start) {
        if rec.len() < columns.len() {
            return Err(AppError::ImportParse {
                message: format!("row has {} field(s), expected {}", rec.len(), columns.len()),
                line: idx + 1,
            });
        }
        let cells = (0..columns.len())
            .map(|j| {
                if rec[j].is_empty() {
                    CellValue::Null
                } else {
                    CellValue::Text(rec[j].clone())
                }
            })
            .collect();
        rows.push(cells);
    }

    // 1-based file line of the first data row (accounts for the header).
    let first_line = start + 1;
    driver
        .import_rows(
            namespace, table, &columns, &pk, conflict, &types, &rows, first_line,
        )
        .await
}

/// A minimal RFC4180 CSV reader → records of fields. Handles quoted fields with
/// embedded commas/newlines and `""` escaping; CRLF and LF line endings.
fn parse_csv(input: &str) -> Vec<Vec<String>> {
    let mut records = Vec::new();
    let mut record = Vec::new();
    let mut field = String::new();
    let mut in_quotes = false;
    let mut chars = input.chars().peekable();

    while let Some(c) = chars.next() {
        if in_quotes {
            match c {
                '"' if chars.peek() == Some(&'"') => {
                    chars.next();
                    field.push('"');
                }
                '"' => in_quotes = false,
                _ => field.push(c),
            }
        } else {
            match c {
                '"' => in_quotes = true,
                ',' => {
                    record.push(std::mem::take(&mut field));
                }
                '\r' => {}
                '\n' => {
                    record.push(std::mem::take(&mut field));
                    records.push(std::mem::take(&mut record));
                }
                _ => field.push(c),
            }
        }
    }
    // Flush a trailing record with no final newline (unless the input ended cleanly).
    if !field.is_empty() || !record.is_empty() {
        record.push(field);
        records.push(record);
    }
    records
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_quotes_commas_and_newlines() {
        let csv = "id,name\n1,\"a,b\"\n2,\"line\nbreak\"\n3,\"he said \"\"hi\"\"\"";
        let recs = parse_csv(csv);
        assert_eq!(recs.len(), 4);
        assert_eq!(recs[0], ["id", "name"]);
        assert_eq!(recs[1], ["1", "a,b"]);
        assert_eq!(recs[2], ["2", "line\nbreak"]);
        assert_eq!(recs[3], ["3", "he said \"hi\""]);
    }

    #[test]
    fn handles_crlf_and_trailing_newline() {
        assert_eq!(
            parse_csv("a,b\r\nc,d\r\n"),
            vec![vec!["a", "b"], vec!["c", "d"]]
        );
    }

    use crate::config::connections::ConnectionProfile;
    use crate::drivers::types::Engine;
    use crate::services::{connection_service, query_service};
    use std::collections::HashMap as Map;
    use tokio::sync::Mutex;

    async fn session(setup: &[&str]) -> (String, SessionRegistry) {
        use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
        let path = std::env::temp_dir()
            .join(format!("basalt-imp-{}.db", uuid::Uuid::new_v4()))
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
        for s in setup {
            sqlx::query(sqlx::AssertSqlSafe(s.to_string()))
                .execute(&pool)
                .await
                .unwrap();
        }
        pool.close().await;
        let profile = ConnectionProfile {
            id: "i".into(),
            name: "i".into(),
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
        let registry: SessionRegistry = Mutex::new(Map::new());
        let info = connection_service::connect(&profile, None, None, &registry)
            .await
            .unwrap();
        (info.session_id, registry)
    }

    fn write_csv(body: &str) -> String {
        let path = std::env::temp_dir().join(format!("basalt-imp-{}.csv", uuid::Uuid::new_v4()));
        std::fs::write(&path, body).unwrap();
        path.to_string_lossy().into_owned()
    }

    async fn scalar_count(sid: &str, sql: &str, reg: &SessionRegistry) -> i64 {
        let out = query_service::run(sid, sql, None, false, None, reg)
            .await
            .unwrap();
        match &out.statements[0].rows[0][0] {
            CellValue::Int(n) => *n,
            other => panic!("expected int, got {other:?}"),
        }
    }

    #[tokio::test]
    async fn conflict_modes_insert_skip_upsert() {
        let (sid, reg) = session(&[
            "CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT)",
            "INSERT INTO t VALUES (1, 'orig')",
        ])
        .await;
        let cols = vec!["id".to_string(), "name".to_string()];

        // insert: adds id=2.
        let f = write_csv("id,name\n2,two\n");
        let r = import(
            &sid,
            "main",
            "t",
            cols.clone(),
            true,
            ConflictMode::Insert,
            &f,
            &reg,
        )
        .await
        .unwrap();
        assert_eq!(r.inserted, 1);

        // skip: id=1 conflict is ignored, id=3 is added; id=1 keeps 'orig'.
        let f = write_csv("id,name\n1,SKIP\n3,three\n");
        import(
            &sid,
            "main",
            "t",
            cols.clone(),
            true,
            ConflictMode::Skip,
            &f,
            &reg,
        )
        .await
        .unwrap();
        assert_eq!(scalar_count(&sid, "SELECT count(*) FROM t", &reg).await, 3);
        let out = query_service::run(
            &sid,
            "SELECT name FROM t WHERE id=1",
            None,
            false,
            None,
            &reg,
        )
        .await
        .unwrap();
        assert_eq!(out.statements[0].rows[0][0], CellValue::Text("orig".into()));

        // upsert: id=1 is updated to 'new'.
        let f = write_csv("id,name\n1,new\n");
        import(
            &sid,
            "main",
            "t",
            cols,
            true,
            ConflictMode::Upsert,
            &f,
            &reg,
        )
        .await
        .unwrap();
        let out = query_service::run(
            &sid,
            "SELECT name FROM t WHERE id=1",
            None,
            false,
            None,
            &reg,
        )
        .await
        .unwrap();
        assert_eq!(out.statements[0].rows[0][0], CellValue::Text("new".into()));
    }

    #[tokio::test]
    async fn reports_error_by_line_and_rolls_back() {
        let (sid, reg) =
            session(&["CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT NOT NULL)"]).await;
        // Row on file line 3 has an empty (→ NULL) name, violating NOT NULL.
        let f = write_csv("id,name\n1,ok\n2,\n");
        let err = import(
            &sid,
            "main",
            "t",
            vec!["id".into(), "name".into()],
            true,
            ConflictMode::Insert,
            &f,
            &reg,
        )
        .await
        .unwrap_err();
        assert_eq!(err.kind(), "importParse");
        assert_eq!(err.detail().unwrap()["line"], 3);
        // Whole batch rolled back — not even the valid first row survives.
        assert_eq!(scalar_count(&sid, "SELECT count(*) FROM t", &reg).await, 0);
    }
}
