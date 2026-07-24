//! One generic batch-execution loop for every engine — the decode differs per
//! engine (`values.rs`), but acquiring a connection, streaming with the fetch-
//! side row limit, and collecting `StatementResult`s is written once here.
//!
//! Row-returning statements (`sqlgen::returns_rows`) are `fetch`ed so the row
//! limit stops the stream early; the rest are `execute`d for their affected-row
//! count. sqlx exposes no generic `rows_affected`, so a tiny `Affected` adapter
//! bridges the three concrete `QueryResult` types.

use std::time::Instant;

use futures_util::StreamExt;
use sqlx::pool::PoolConnection;
use sqlx::{AssertSqlSafe, Database, Executor, IntoArguments};

use crate::drivers::types::{CellValue, ColumnInfo, StatementError, StatementResult};
use crate::sqlgen::{self, Statement};
use crate::{AppError, AppResult};

/// Bridges the per-engine `rows_affected` (no generic `QueryResult` trait exists).
pub trait Affected {
    fn affected(&self) -> u64;
}

impl Affected for sqlx::postgres::PgQueryResult {
    fn affected(&self) -> u64 {
        self.rows_affected()
    }
}
impl Affected for sqlx::mysql::MySqlQueryResult {
    fn affected(&self) -> u64 {
        self.rows_affected()
    }
}
impl Affected for sqlx::sqlite::SqliteQueryResult {
    fn affected(&self) -> u64 {
        self.rows_affected()
    }
}

/// Runs every statement on a single pooled connection (so a `BEGIN`/`COMMIT` in
/// the batch shares one connection). Stops at the first failing statement,
/// carrying its error on that statement's result.
pub async fn run_batch<DB, FC, FR>(
    pool: &sqlx::Pool<DB>,
    statements: &[Statement],
    limit: usize,
    columns_of: FC,
    decode: FR,
) -> AppResult<Vec<StatementResult>>
where
    DB: Database,
    DB::QueryResult: Affected,
    for<'c> &'c mut DB::Connection: Executor<'c, Database = DB>,
    DB::Arguments: IntoArguments<DB> + Default,
    FC: Fn(&DB::Row) -> Vec<ColumnInfo>,
    FR: Fn(&DB::Row) -> Vec<CellValue>,
{
    let mut conn = pool.acquire().await.map_err(AppError::internal)?;
    let mut out = Vec::with_capacity(statements.len());
    for stmt in statements {
        match run_one::<DB, _, _>(&mut conn, &stmt.text, limit, &columns_of, &decode).await {
            Ok(result) => out.push(result),
            Err(e) => {
                out.push(StatementResult {
                    columns: Vec::new(),
                    rows: Vec::new(),
                    rows_affected: 0,
                    truncated: false,
                    duration_ms: 0,
                    error: Some(StatementError {
                        kind: e.kind().to_string(),
                        message: e.to_string(),
                        detail: e.detail(),
                    }),
                });
                break;
            }
        }
    }
    Ok(out)
}

async fn run_one<DB, FC, FR>(
    conn: &mut PoolConnection<DB>,
    text: &str,
    limit: usize,
    columns_of: &FC,
    decode: &FR,
) -> AppResult<StatementResult>
where
    DB: Database,
    DB::QueryResult: Affected,
    for<'c> &'c mut DB::Connection: Executor<'c, Database = DB>,
    DB::Arguments: IntoArguments<DB> + Default,
    FC: Fn(&DB::Row) -> Vec<ColumnInfo>,
    FR: Fn(&DB::Row) -> Vec<CellValue>,
{
    let start = Instant::now();

    if sqlgen::returns_rows(text) {
        let mut columns = Vec::new();
        let mut rows = Vec::new();
        let mut truncated = false;
        {
            let mut stream = sqlx::query(AssertSqlSafe(text.to_owned())).fetch(&mut **conn);
            while let Some(item) = stream.next().await {
                let row = item.map_err(map_query_error)?;
                if columns.is_empty() {
                    columns = columns_of(&row);
                }
                if rows.len() < limit {
                    rows.push(decode(&row));
                } else {
                    truncated = true;
                    break;
                }
            }
        }
        let rows_affected = rows.len() as u64;
        Ok(StatementResult {
            columns,
            rows,
            rows_affected,
            truncated,
            duration_ms: start.elapsed().as_millis() as u64,
            error: None,
        })
    } else {
        let result = sqlx::query(AssertSqlSafe(text.to_owned()))
            .execute(&mut **conn)
            .await
            .map_err(map_query_error)?;
        Ok(StatementResult {
            columns: Vec::new(),
            rows: Vec::new(),
            rows_affected: result.affected(),
            truncated: false,
            duration_ms: start.elapsed().as_millis() as u64,
            error: None,
        })
    }
}

/// Query-execution failures carry the engine's message + SQLSTATE so the editor
/// can surface a specific `queryError` (position underlining lands later).
fn map_query_error(e: sqlx::Error) -> AppError {
    match &e {
        sqlx::Error::Database(db) => AppError::QueryError {
            message: db.message().to_string(),
            detail: db
                .code()
                .map(|code| serde_json::json!({ "code": code.to_string() })),
        },
        _ => AppError::QueryError {
            message: e.to_string(),
            detail: None,
        },
    }
}
