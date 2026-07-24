//! Postgres schema introspection. Namespaces are schemas (system schemas
//! hidden). Object names reach `describe_table` as **bound parameters** ($1/$2),
//! never string-formatted into SQL, so introspection carries no injection
//! surface. Column type names come from `format_type` so users see the canonical
//! spelling (`numeric(20,4)`, `integer[]`, `mood`) rather than `USER-DEFINED`.

use sqlx::{PgPool, Row};

use crate::drivers::types::{
    ColumnInfo, IndexInfo, Namespace, RelationKind, RelationNode, SchemaTree, TableDescription,
};
use crate::{AppError, AppResult};

pub async fn introspect(pool: &PgPool) -> AppResult<SchemaTree> {
    // One ordered pass; consecutive rows with the same schema form a namespace.
    // Empty schemas (no tables/views) are omitted — a schema browser has nothing
    // to show under them, and they reappear the moment they hold a relation.
    let rows = sqlx::query(
        "SELECT table_schema, table_name, table_type \
         FROM information_schema.tables \
         WHERE table_schema NOT IN ('pg_catalog', 'information_schema') \
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
                "VIEW" => RelationKind::View,
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
    pool: &PgPool,
    namespace: &str,
    table: &str,
) -> AppResult<TableDescription> {
    Ok(TableDescription {
        columns: fetch_columns(pool, namespace, table).await?,
        indexes: fetch_indexes(pool, namespace, table).await?,
    })
}

async fn fetch_columns(pool: &PgPool, schema: &str, table: &str) -> AppResult<Vec<ColumnInfo>> {
    // pg_attribute drives ordering and gives `attnotnull` + `format_type`; the
    // LEFT JOIN to the primary-key index flags PK members (composite keys match
    // one row per column). `indkey` is an int2vector — cast to int2[] for `ANY`.
    let rows = sqlx::query(
        "SELECT a.attname AS name, \
                format_type(a.atttypid, a.atttypmod) AS type_name, \
                a.attnotnull AS not_null, \
                (pk.attnum IS NOT NULL) AS is_pk \
         FROM pg_attribute a \
         JOIN pg_class c ON c.oid = a.attrelid \
         JOIN pg_namespace n ON n.oid = c.relnamespace \
         LEFT JOIN ( \
             SELECT i.indrelid, unnest(i.indkey::int2[]) AS attnum \
             FROM pg_index i WHERE i.indisprimary \
         ) pk ON pk.indrelid = c.oid AND pk.attnum = a.attnum \
         WHERE n.nspname = $1 AND c.relname = $2 \
           AND a.attnum > 0 AND NOT a.attisdropped \
         ORDER BY a.attnum",
    )
    .bind(schema)
    .bind(table)
    .fetch_all(pool)
    .await
    .map_err(AppError::internal)?;

    let mut columns = Vec::with_capacity(rows.len());
    for row in rows {
        let name: String = row.try_get("name").map_err(AppError::internal)?;
        let type_name: String = row.try_get("type_name").map_err(AppError::internal)?;
        let not_null: bool = row.try_get("not_null").map_err(AppError::internal)?;
        let is_pk: bool = row.try_get("is_pk").map_err(AppError::internal)?;
        columns.push(ColumnInfo {
            name,
            type_name,
            nullable: !not_null,
            is_pk,
        });
    }
    Ok(columns)
}

async fn fetch_indexes(pool: &PgPool, schema: &str, table: &str) -> AppResult<Vec<IndexInfo>> {
    // One row per (index, column) ordered by the column's position within the
    // index; grouped below. Includes the PK's implicit unique index, as a DB GUI
    // should. `array_position(indkey, attnum)` orders composite-index members.
    let rows = sqlx::query(
        "SELECT i.relname AS index_name, ix.indisunique AS is_unique, a.attname AS column_name \
         FROM pg_class t \
         JOIN pg_namespace n ON n.oid = t.relnamespace \
         JOIN pg_index ix ON ix.indrelid = t.oid \
         JOIN pg_class i ON i.oid = ix.indexrelid \
         JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey::int2[]) \
         WHERE n.nspname = $1 AND t.relname = $2 \
         ORDER BY i.relname, array_position(ix.indkey::int2[], a.attnum)",
    )
    .bind(schema)
    .bind(table)
    .fetch_all(pool)
    .await
    .map_err(AppError::internal)?;

    let mut indexes: Vec<IndexInfo> = Vec::new();
    for row in rows {
        let index_name: String = row.try_get("index_name").map_err(AppError::internal)?;
        let is_unique: bool = row.try_get("is_unique").map_err(AppError::internal)?;
        let column: String = row.try_get("column_name").map_err(AppError::internal)?;
        match indexes.last_mut() {
            Some(idx) if idx.name == index_name => idx.columns.push(column),
            _ => indexes.push(IndexInfo {
                name: index_name,
                columns: vec![column],
                unique: is_unique,
            }),
        }
    }
    Ok(indexes)
}
