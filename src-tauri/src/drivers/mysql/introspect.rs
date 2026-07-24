//! MySQL schema introspection. A MySQL "database" is a namespace, so every
//! non-system schema on the server is a namespace (same shape as Postgres). Names
//! reach `describe_table` as **bound `?` parameters**, never string-formatted, so
//! there is no injection surface. Type names use `column_type` (the full
//! declaration — `varchar(64)`, `tinyint(1)`, `enum(...)`) rather than the bare
//! `data_type`. `information_schema` integer widths vary across versions, so
//! counts are `CAST(... AS SIGNED)` to decode as a stable `i64`. MySQL 8 labels
//! `information_schema` result columns in UPPERCASE, so every column is aliased
//! to the lowercase name `try_get` looks up.

use sqlx::{MySqlPool, Row};

use crate::drivers::types::{
    ColumnInfo, IndexInfo, Namespace, RelationKind, RelationNode, SchemaTree, TableDescription,
};
use crate::{AppError, AppResult};

pub async fn introspect(pool: &MySqlPool) -> AppResult<SchemaTree> {
    // Ordered pass; consecutive rows with the same schema form a namespace.
    let rows = sqlx::query(
        "SELECT table_schema AS table_schema, \
                table_name AS table_name, \
                table_type AS table_type \
         FROM information_schema.tables \
         WHERE table_schema NOT IN \
            ('mysql', 'information_schema', 'performance_schema', 'sys') \
         ORDER BY table_schema, table_name",
    )
    .fetch_all(pool)
    .await
    .map_err(AppError::internal)?;

    let mut namespaces: Vec<Namespace> = Vec::new();
    for row in rows {
        let schema: String = row.try_get("table_schema").map_err(AppError::internal)?;
        let name: String = row.try_get("table_name").map_err(AppError::internal)?;
        let table_type: String = row.try_get("table_type").map_err(AppError::internal)?;
        let node = RelationNode {
            name,
            kind: match table_type.as_str() {
                "VIEW" | "SYSTEM VIEW" => RelationKind::View,
                _ => RelationKind::Table,
            },
        };
        match namespaces.last_mut() {
            Some(ns) if ns.name == schema => ns.relations.push(node),
            _ => namespaces.push(Namespace {
                name: schema,
                relations: vec![node],
            }),
        }
    }

    Ok(SchemaTree { namespaces })
}

pub async fn describe_table(
    pool: &MySqlPool,
    namespace: &str,
    table: &str,
) -> AppResult<TableDescription> {
    Ok(TableDescription {
        columns: fetch_columns(pool, namespace, table).await?,
        indexes: fetch_indexes(pool, namespace, table).await?,
    })
}

async fn fetch_columns(pool: &MySqlPool, schema: &str, table: &str) -> AppResult<Vec<ColumnInfo>> {
    // `column_key = 'PRI'` marks a primary-key member, so PKs need no separate
    // query. `is_nullable` is the string 'YES'/'NO'.
    let rows = sqlx::query(
        "SELECT column_name AS column_name, \
                column_type AS column_type, \
                is_nullable AS is_nullable, \
                column_key AS column_key \
         FROM information_schema.columns \
         WHERE table_schema = ? AND table_name = ? \
         ORDER BY ordinal_position",
    )
    .bind(schema)
    .bind(table)
    .fetch_all(pool)
    .await
    .map_err(AppError::internal)?;

    let mut columns = Vec::with_capacity(rows.len());
    for row in rows {
        let name: String = row.try_get("column_name").map_err(AppError::internal)?;
        let type_name: String = row.try_get("column_type").map_err(AppError::internal)?;
        let is_nullable: String = row.try_get("is_nullable").map_err(AppError::internal)?;
        let column_key: String = row.try_get("column_key").map_err(AppError::internal)?;
        columns.push(ColumnInfo {
            name,
            type_name,
            nullable: is_nullable == "YES",
            is_pk: column_key == "PRI",
        });
    }
    Ok(columns)
}

async fn fetch_indexes(pool: &MySqlPool, schema: &str, table: &str) -> AppResult<Vec<IndexInfo>> {
    // One row per (index, column) ordered within each index by `seq_in_index`;
    // grouped below. `non_unique = 0` means unique. The PK is index 'PRIMARY'.
    let rows = sqlx::query(
        "SELECT index_name AS index_name, \
                CAST(non_unique AS SIGNED) AS non_unique, \
                column_name AS column_name \
         FROM information_schema.statistics \
         WHERE table_schema = ? AND table_name = ? \
         ORDER BY index_name, seq_in_index",
    )
    .bind(schema)
    .bind(table)
    .fetch_all(pool)
    .await
    .map_err(AppError::internal)?;

    let mut indexes: Vec<IndexInfo> = Vec::new();
    for row in rows {
        let index_name: String = row.try_get("index_name").map_err(AppError::internal)?;
        let non_unique: i64 = row.try_get("non_unique").map_err(AppError::internal)?;
        let column: String = row.try_get("column_name").map_err(AppError::internal)?;
        match indexes.last_mut() {
            Some(idx) if idx.name == index_name => idx.columns.push(column),
            _ => indexes.push(IndexInfo {
                name: index_name,
                columns: vec![column],
                unique: non_unique == 0,
            }),
        }
    }
    Ok(indexes)
}
