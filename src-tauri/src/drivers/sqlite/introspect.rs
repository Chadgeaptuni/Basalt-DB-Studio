//! SQLite schema introspection. SQLite exposes exactly one namespace we care
//! about in v1 — the primary database, always named `main` — so the tree has a
//! single namespace. Object names reach these queries as *bound parameters* to
//! the `pragma_*` table-valued functions (SQLite 3.16+), never string-formatted
//! into SQL, so introspection carries no injection surface.

use sqlx::{Row, SqlitePool};

use crate::drivers::types::{
    ColumnInfo, IndexInfo, Namespace, RelationKind, RelationNode, SchemaTree, TableDescription,
};
use crate::{AppError, AppResult};

/// The only schema SQLite exposes in v1 (attached databases are deferred).
const MAIN_SCHEMA: &str = "main";

pub async fn introspect(pool: &SqlitePool) -> AppResult<SchemaTree> {
    // `sqlite_%` names are internal (sequences, auto-indexes) — hide them.
    let rows = sqlx::query(
        "SELECT name, type FROM sqlite_master \
         WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' \
         ORDER BY type, name",
    )
    .fetch_all(pool)
    .await
    .map_err(AppError::internal)?;

    let mut relations = Vec::with_capacity(rows.len());
    for row in rows {
        let name: String = row.try_get("name").map_err(AppError::internal)?;
        let kind: String = row.try_get("type").map_err(AppError::internal)?;
        relations.push(RelationNode {
            name,
            kind: match kind.as_str() {
                "view" => RelationKind::View,
                _ => RelationKind::Table,
            },
        });
    }

    Ok(SchemaTree {
        namespaces: vec![Namespace {
            name: MAIN_SCHEMA.to_string(),
            relations,
        }],
    })
}

pub async fn describe_table(
    pool: &SqlitePool,
    namespace: &str,
    table: &str,
) -> AppResult<TableDescription> {
    if namespace != MAIN_SCHEMA {
        return Err(AppError::Internal(format!(
            "unknown SQLite schema '{namespace}' (only 'main' is supported in v1)"
        )));
    }
    Ok(TableDescription {
        columns: fetch_columns(pool, table).await?,
        indexes: fetch_indexes(pool, table).await?,
    })
}

async fn fetch_columns(pool: &SqlitePool, table: &str) -> AppResult<Vec<ColumnInfo>> {
    // pragma_table_info: cid, name, type, notnull, dflt_value, pk.
    let rows =
        sqlx::query("SELECT name, type, \"notnull\", pk FROM pragma_table_info(?) ORDER BY cid")
            .bind(table)
            .fetch_all(pool)
            .await
            .map_err(AppError::internal)?;

    let mut columns = Vec::with_capacity(rows.len());
    for row in rows {
        let name: String = row.try_get("name").map_err(AppError::internal)?;
        let type_name: String = row.try_get("type").map_err(AppError::internal)?;
        let notnull: i64 = row.try_get("notnull").map_err(AppError::internal)?;
        // `pk` is the 1-based position of the column in the primary key, 0 if not
        // part of it — so any positive value means "part of the PK".
        let pk: i64 = row.try_get("pk").map_err(AppError::internal)?;
        columns.push(ColumnInfo {
            name,
            type_name,
            nullable: notnull == 0,
            is_pk: pk > 0,
        });
    }
    Ok(columns)
}

async fn fetch_indexes(pool: &SqlitePool, table: &str) -> AppResult<Vec<IndexInfo>> {
    // pragma_index_list: seq, name, unique, origin, partial.
    let index_rows = sqlx::query("SELECT name, \"unique\" FROM pragma_index_list(?) ORDER BY seq")
        .bind(table)
        .fetch_all(pool)
        .await
        .map_err(AppError::internal)?;

    let mut indexes = Vec::with_capacity(index_rows.len());
    for row in index_rows {
        let name: String = row.try_get("name").map_err(AppError::internal)?;
        let unique: i64 = row.try_get("unique").map_err(AppError::internal)?;
        let columns = fetch_index_columns(pool, &name).await?;
        indexes.push(IndexInfo {
            name,
            columns,
            unique: unique != 0,
        });
    }
    Ok(indexes)
}

async fn fetch_index_columns(pool: &SqlitePool, index: &str) -> AppResult<Vec<String>> {
    // pragma_index_info: seqno, cid, name. `name` is NULL for expression indexes;
    // those positions have no column to report, so they are skipped.
    let rows = sqlx::query("SELECT name FROM pragma_index_info(?) ORDER BY seqno")
        .bind(index)
        .fetch_all(pool)
        .await
        .map_err(AppError::internal)?;

    let mut columns = Vec::with_capacity(rows.len());
    for row in rows {
        let name: Option<String> = row.try_get("name").map_err(AppError::internal)?;
        if let Some(name) = name {
            columns.push(name);
        }
    }
    Ok(columns)
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    /// A single shared in-memory connection so DDL and introspection see the same
    /// database (a multi-connection pool would hand out independent `:memory:`s).
    async fn seeded_pool() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("open in-memory sqlite");

        for stmt in [
            "CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL, name TEXT)",
            "CREATE UNIQUE INDEX idx_users_email ON users(email)",
            "CREATE VIEW active_users AS SELECT id, email FROM users",
        ] {
            sqlx::query(stmt).execute(&pool).await.expect(stmt);
        }
        pool
    }

    #[tokio::test]
    async fn introspect_lists_tables_and_views_under_main() {
        let pool = seeded_pool().await;
        let tree = introspect(&pool).await.unwrap();

        assert_eq!(tree.namespaces.len(), 1);
        let ns = &tree.namespaces[0];
        assert_eq!(ns.name, "main");

        let table = ns.relations.iter().find(|r| r.name == "users").unwrap();
        assert_eq!(table.kind, RelationKind::Table);
        let view = ns
            .relations
            .iter()
            .find(|r| r.name == "active_users")
            .unwrap();
        assert_eq!(view.kind, RelationKind::View);
    }

    #[tokio::test]
    async fn describe_table_reports_columns_and_indexes() {
        let pool = seeded_pool().await;
        let desc = describe_table(&pool, "main", "users").await.unwrap();

        assert_eq!(desc.columns.len(), 3);
        let id = desc.columns.iter().find(|c| c.name == "id").unwrap();
        assert!(id.is_pk, "id is the primary key");
        let email = desc.columns.iter().find(|c| c.name == "email").unwrap();
        assert!(!email.nullable, "email is declared NOT NULL");
        assert!(!email.is_pk);
        let name = desc.columns.iter().find(|c| c.name == "name").unwrap();
        assert!(name.nullable, "name has no NOT NULL constraint");

        let index = desc
            .indexes
            .iter()
            .find(|i| i.name == "idx_users_email")
            .unwrap();
        assert!(index.unique);
        assert_eq!(index.columns, vec!["email".to_string()]);
    }

    #[tokio::test]
    async fn describe_table_rejects_unknown_schema() {
        let pool = seeded_pool().await;
        let err = describe_table(&pool, "temp", "users").await.unwrap_err();
        assert_eq!(err.kind(), "internal");
    }
}
