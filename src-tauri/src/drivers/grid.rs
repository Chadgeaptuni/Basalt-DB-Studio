//! One generic transactional grid-commit loop for every engine. The per-engine
//! bind (reverse of decode) lives in each `values.rs`; the SQL structure
//! (SET/WHERE/INSERT), the single-transaction envelope, and the `rows_affected
//! == 1` identity check are written once here.
//!
//! Row identity is the PK (or, as a fallback, every non-binary column) supplied
//! by the caller. An UPDATE/DELETE that matches ≠ 1 row means the identity was
//! not unique → the whole batch rolls back with `ambiguousRowIdentity`.

use std::collections::HashMap;

use sqlx::{Database, Executor, IntoArguments, Pool, QueryBuilder, Transaction};

use super::exec::{map_query_error, Affected};
use crate::drivers::types::{CellValue, Engine, GridCommitResult, GridEdit};
use crate::sqlgen::{quote_ident, quote_qualified};
use crate::{AppError, AppResult};

/// The resolved commit target: table, row-identity columns, and column→type map
/// (the type feeds Postgres's `::type` casts; other engines ignore it).
pub struct GridWrite<'a> {
    pub engine: Engine,
    pub namespace: &'a str,
    pub table: &'a str,
    pub key_columns: &'a [String],
    pub types: &'a HashMap<String, String>,
    pub edits: &'a [GridEdit],
}

pub async fn commit<DB, Bind>(
    pool: &Pool<DB>,
    w: &GridWrite<'_>,
    bind: Bind,
) -> AppResult<GridCommitResult>
where
    DB: Database,
    DB::QueryResult: Affected,
    for<'c> &'c mut DB::Connection: Executor<'c, Database = DB>,
    DB::Arguments: IntoArguments<DB> + Default,
    Bind: Fn(&mut QueryBuilder<DB>, &CellValue, &str) + Copy,
{
    let qualified = quote_qualified(w.engine, w.namespace, w.table);
    let mut tx = pool.begin().await.map_err(AppError::internal)?;
    let mut total = 0u64;
    for (index, edit) in w.edits.iter().enumerate() {
        let affected = exec_edit(&mut tx, w, &qualified, edit, bind)
            .await
            .map_err(|e| with_index(e, index))?;
        // Row identity must resolve to exactly one row (else the batch is unsafe).
        if matches!(edit, GridEdit::Update { .. } | GridEdit::Delete { .. }) && affected != 1 {
            tx.rollback().await.ok();
            return Err(AppError::AmbiguousRowIdentity {
                message: format!(
                    "edit {index} matched {affected} rows (expected exactly 1); rolled back"
                ),
                index,
            });
        }
        total += affected;
    }
    tx.commit().await.map_err(AppError::internal)?;
    Ok(GridCommitResult {
        rows_affected: total,
    })
}

async fn exec_edit<DB, Bind>(
    tx: &mut Transaction<'_, DB>,
    w: &GridWrite<'_>,
    qualified: &str,
    edit: &GridEdit,
    bind: Bind,
) -> AppResult<u64>
where
    DB: Database,
    DB::QueryResult: Affected,
    for<'c> &'c mut DB::Connection: Executor<'c, Database = DB>,
    DB::Arguments: IntoArguments<DB> + Default,
    Bind: Fn(&mut QueryBuilder<DB>, &CellValue, &str) + Copy,
{
    let mut qb: QueryBuilder<DB> = QueryBuilder::new("");
    match edit {
        GridEdit::Update { key, set } => {
            qb.push("UPDATE ").push(qualified).push(" SET ");
            for (j, change) in set.iter().enumerate() {
                if j > 0 {
                    qb.push(", ");
                }
                qb.push(quote_ident(w.engine, &change.column)).push(" = ");
                bind(&mut qb, &change.value, type_of(w, &change.column));
            }
            push_where(&mut qb, w, key, bind);
        }
        GridEdit::Delete { key } => {
            qb.push("DELETE FROM ").push(qualified);
            push_where(&mut qb, w, key, bind);
        }
        GridEdit::Insert { set } => {
            qb.push("INSERT INTO ").push(qualified).push(" (");
            for (j, change) in set.iter().enumerate() {
                if j > 0 {
                    qb.push(", ");
                }
                qb.push(quote_ident(w.engine, &change.column));
            }
            qb.push(") VALUES (");
            for (j, change) in set.iter().enumerate() {
                if j > 0 {
                    qb.push(", ");
                }
                bind(&mut qb, &change.value, type_of(w, &change.column));
            }
            qb.push(")");
        }
    }
    let result = qb
        .build()
        .execute(&mut **tx)
        .await
        .map_err(map_query_error)?;
    Ok(result.affected())
}

fn push_where<DB, Bind>(qb: &mut QueryBuilder<DB>, w: &GridWrite<'_>, key: &[CellValue], bind: Bind)
where
    DB: Database,
    Bind: Fn(&mut QueryBuilder<DB>, &CellValue, &str) + Copy,
{
    qb.push(" WHERE ");
    for (i, col) in w.key_columns.iter().enumerate() {
        if i > 0 {
            qb.push(" AND ");
        }
        qb.push(quote_ident(w.engine, col));
        // A NULL identity value needs `IS NULL` — `= NULL` never matches.
        match key.get(i) {
            Some(CellValue::Null) | None => {
                qb.push(" IS NULL");
            }
            Some(value) => {
                qb.push(" = ");
                bind(qb, value, type_of(w, col));
            }
        }
    }
}

fn type_of<'a>(w: &'a GridWrite<'_>, column: &str) -> &'a str {
    w.types.get(column).map(String::as_str).unwrap_or("")
}

/// Tags a failing edit's `queryError` with its `index` so the grid can highlight
/// the offending row (mirrors `AmbiguousRowIdentity`'s index detail).
fn with_index(err: AppError, index: usize) -> AppError {
    match err {
        AppError::QueryError { message, detail } => {
            let mut obj = detail
                .and_then(|d| d.as_object().cloned())
                .unwrap_or_default();
            obj.insert("index".into(), serde_json::json!(index));
            AppError::QueryError {
                message,
                detail: Some(serde_json::Value::Object(obj)),
            }
        }
        other => other,
    }
}
