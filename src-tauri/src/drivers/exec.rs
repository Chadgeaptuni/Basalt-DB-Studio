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
use sqlx::{AssertSqlSafe, Database, Executor, IntoArguments, Row, SqlSafeStr, Statement as _};

use crate::drivers::types::{CellValue, ColumnInfo, StatementError, StatementResult};
use crate::sqlgen::{self, Statement};
use crate::AppError;

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

/// What a batch produced, and whether the connection it ran on is still usable.
pub struct Batch {
    pub results: Vec<StatementResult>,
    /// A failure below the SQL layer (socket, protocol, worker): the connection
    /// cannot be trusted with the next run.
    pub broken: bool,
}

/// Runs every statement on one connection (so a `BEGIN`/`COMMIT` in the batch
/// shares it). Stops at the first failing statement, carrying its error on that
/// statement's result.
pub async fn run_batch<DB, FC, FR>(
    conn: &mut DB::Connection,
    statements: &[Statement],
    limit: usize,
    columns_of: FC,
    decode: FR,
) -> Batch
where
    DB: Database,
    DB::QueryResult: Affected,
    for<'c> &'c mut DB::Connection: Executor<'c, Database = DB>,
    DB::Arguments: IntoArguments<DB> + Default,
    FC: Fn(&[DB::Column]) -> Vec<ColumnInfo>,
    FR: Fn(&DB::Row) -> Vec<CellValue>,
{
    let mut results = Vec::with_capacity(statements.len());
    for stmt in statements {
        match run_one::<DB, _, _>(conn, &stmt.text, limit, &columns_of, &decode).await {
            Ok(result) => results.push(result),
            Err(e) => {
                let broken = !matches!(e, sqlx::Error::Database(_));
                let e = map_query_error(e);
                results.push(StatementResult {
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
                return Batch { results, broken };
            }
        }
    }
    Batch {
        results,
        broken: false,
    }
}

async fn run_one<DB, FC, FR>(
    conn: &mut DB::Connection,
    text: &str,
    limit: usize,
    columns_of: &FC,
    decode: &FR,
) -> Result<StatementResult, sqlx::Error>
where
    DB: Database,
    DB::QueryResult: Affected,
    for<'c> &'c mut DB::Connection: Executor<'c, Database = DB>,
    DB::Arguments: IntoArguments<DB> + Default,
    FC: Fn(&[DB::Column]) -> Vec<ColumnInfo>,
    FR: Fn(&DB::Row) -> Vec<CellValue>,
{
    let start = Instant::now();

    if sqlgen::returns_rows(text) {
        let mut columns = Vec::new();
        let mut rows = Vec::new();
        let mut truncated = false;
        {
            let mut stream = sqlx::query(AssertSqlSafe(text.to_owned())).fetch(&mut *conn);
            while let Some(item) = stream.next().await {
                let row = item?;
                if columns.is_empty() {
                    columns = columns_of(row.columns());
                }
                if rows.len() < limit {
                    rows.push(decode(&row));
                } else {
                    truncated = true;
                    break;
                }
            }
        }
        // No row, no row description: prepare the statement for its column list so
        // an empty result still shows its headers. Best effort — a statement the
        // engine will not prepare simply stays headerless.
        if columns.is_empty() {
            if let Ok(prepared) = (&mut *conn)
                .prepare(AssertSqlSafe(text.to_owned()).into_sql_str())
                .await
            {
                columns = columns_of(prepared.columns());
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
            .execute(&mut *conn)
            .await?;
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
/// can surface a specific `queryError` (position underlining lands later). Shared
/// with the grid-commit loop (`super::grid`).
pub(super) fn map_query_error(e: sqlx::Error) -> AppError {
    match &e {
        // pg `57014 query_canceled`; MySQL `ER_QUERY_INTERRUPTED` (1317) → `70100`;
        // SQLite `SQLITE_INTERRUPT` (9), raised by the pinned connection's handler.
        sqlx::Error::Database(db)
            if matches!(db.code().as_deref(), Some("57014" | "70100" | "9")) =>
        {
            AppError::QueryCancelled(db.message().to_string())
        }
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
