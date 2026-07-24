//! Streaming export: a query is re-run and its full result streamed row-by-row to
//! a `RowSink` (the service writes CSV/JSON to a file + reports progress). Rows are
//! never buffered here, so a 100k-row export uses flat memory and never freezes the
//! UI (progress flows over an `ipc::Channel`).

use futures_util::StreamExt;
use sqlx::{AssertSqlSafe, Database, Executor, IntoArguments};

use super::exec::map_query_error;
use crate::drivers::types::{CellValue, ColumnInfo};
use crate::{AppError, AppResult};

/// Receives the column header once, then every decoded row as the query streams.
pub trait RowSink {
    fn header(&mut self, columns: &[ColumnInfo]) -> AppResult<()>;
    fn row(&mut self, cells: &[CellValue]) -> AppResult<()>;
}

pub async fn stream<DB, FC, FR>(
    pool: &sqlx::Pool<DB>,
    sql: &str,
    columns_of: FC,
    decode: FR,
    sink: &mut (dyn RowSink + Send),
) -> AppResult<u64>
where
    DB: Database,
    for<'c> &'c mut DB::Connection: Executor<'c, Database = DB>,
    DB::Arguments: IntoArguments<DB> + Default,
    FC: Fn(&DB::Row) -> Vec<ColumnInfo>,
    FR: Fn(&DB::Row) -> Vec<CellValue>,
{
    let mut conn = pool.acquire().await.map_err(AppError::internal)?;
    let mut rows = sqlx::query(AssertSqlSafe(sql.to_owned())).fetch(&mut *conn);
    let mut n = 0u64;
    let mut sent_header = false;
    while let Some(item) = rows.next().await {
        let row = item.map_err(map_query_error)?;
        if !sent_header {
            sink.header(&columns_of(&row))?;
            sent_header = true;
        }
        sink.row(&decode(&row))?;
        n += 1;
    }
    Ok(n)
}
