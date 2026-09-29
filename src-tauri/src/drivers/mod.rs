//! The `Driver` enum is the single match-dispatch site for engine differences —
//! no `dyn` traits (enum dispatch keeps the bundle lean and the branches
//! explicit). One variant per supported engine; each holds its sqlx pool.
//!
//! Cloning a `Driver` clones the underlying sqlx pool handle (an `Arc`), which
//! lets a caller lift the driver out of the session registry under a short lock
//! and then await the database without holding it.

mod exec;
pub mod export;
mod grid;
mod import;
mod mysql;
mod pg;
mod sqlite;
pub mod types;

pub use exec::Batch;

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use sqlx::pool::PoolConnection;
use sqlx::{AssertSqlSafe, MySql, MySqlPool, PgPool, Postgres, Sqlite, SqlitePool};

use crate::sqlgen::Statement;
use crate::{AppError, AppResult};
use types::{
    CellValue, ConflictMode, Engine, GridCommitResult, GridEdit, ImportResult, SchemaTree,
    StatementResult, TableDescription,
};

#[derive(Clone)]
pub enum Driver {
    Postgres(PgPool),
    MySql(MySqlPool),
    Sqlite(SqlitePool),
}

/// The session's editor connection, held across runs so a `BEGIN` in one run and
/// the `COMMIT` in the next share it — the tx boundary the status bar reports.
pub enum PinnedConn {
    Postgres(PoolConnection<Postgres>),
    MySql(PoolConnection<MySql>),
    Sqlite(PoolConnection<Sqlite>),
}

/// What stops a pinned connection's running statement.
#[derive(Clone)]
pub enum CancelTarget {
    Backend(u64),
    Interrupt(Arc<AtomicBool>),
}

impl CancelTarget {
    /// Clears a raised interrupt so the next run is not born cancelled.
    pub fn arm(&self) {
        if let CancelTarget::Interrupt(flag) = self {
            flag.store(false, Ordering::Relaxed);
        }
    }
}

impl PinnedConn {
    /// Runs a pre-split batch, buffering up to `limit` rows per statement. Stops at
    /// the first failure (carried on that statement's result). The confirmation
    /// and read-only gates run in the query service before this is called.
    pub async fn run(&mut self, statements: &[Statement], limit: usize) -> Batch {
        match self {
            PinnedConn::Postgres(c) => {
                exec::run_batch::<Postgres, _, _>(
                    &mut **c,
                    statements,
                    limit,
                    pg::columns,
                    pg::decode_row,
                )
                .await
            }
            PinnedConn::MySql(c) => {
                exec::run_batch::<MySql, _, _>(
                    &mut **c,
                    statements,
                    limit,
                    mysql::columns,
                    mysql::decode_row,
                )
                .await
            }
            PinnedConn::Sqlite(c) => {
                exec::run_batch::<Sqlite, _, _>(
                    &mut **c,
                    statements,
                    limit,
                    sqlite::columns,
                    sqlite::decode_row,
                )
                .await
            }
        }
    }

    /// What stops this connection's running statement: the server-side id for
    /// Postgres/MySQL, an interrupt flag for SQLite.
    async fn cancel_target(&mut self) -> AppResult<CancelTarget> {
        match self {
            PinnedConn::Postgres(c) => {
                let pid: i32 = sqlx::query_scalar("SELECT pg_backend_pid()")
                    .fetch_one(&mut **c)
                    .await
                    .map_err(unpooled)?;
                Ok(CancelTarget::Backend(pid as u64))
            }
            PinnedConn::MySql(c) => {
                let id: u64 = sqlx::query_scalar("SELECT CONNECTION_ID()")
                    .fetch_one(&mut **c)
                    .await
                    .map_err(unpooled)?;
                Ok(CancelTarget::Backend(id))
            }
            PinnedConn::Sqlite(c) => {
                let flag = Arc::new(AtomicBool::new(false));
                let raised = flag.clone();
                // Checked every ~10k VM steps; returning false interrupts the
                // statement with SQLITE_INTERRUPT (sqlite.org/c3ref/progress_handler.html).
                c.lock_handle()
                    .await
                    .map_err(unpooled)?
                    .set_progress_handler(10_000, move || !raised.load(Ordering::Relaxed));
                Ok(CancelTarget::Interrupt(flag))
            }
        }
    }

    /// Closes the connection rather than returning it to the pool — for one whose
    /// state is unknown after a dropped run.
    pub fn discard(mut self) {
        match &mut self {
            PinnedConn::Postgres(c) => c.close_on_drop(),
            PinnedConn::MySql(c) => c.close_on_drop(),
            PinnedConn::Sqlite(c) => c.close_on_drop(),
        }
    }
}

impl Driver {
    pub async fn introspect(&self) -> AppResult<SchemaTree> {
        match self {
            Driver::Postgres(pool) => pg::introspect(pool).await,
            Driver::MySql(pool) => mysql::introspect(pool).await,
            Driver::Sqlite(pool) => sqlite::introspect(pool).await,
        }
    }

    /// The other databases on this server, for the tree's database level.
    ///
    /// Postgres only, because it is the only engine that needs one: a MySQL
    /// connection already sees every database on the server as a namespace of
    /// `introspect`, and a SQLite file *is* the database. Those two return empty
    /// rather than erroring so the command stays total — the tree does not draw
    /// the level for them, and a caller that asks anyway gets "nothing to
    /// browse", not a failure.
    pub async fn list_databases(&self) -> AppResult<Vec<String>> {
        match self {
            Driver::Postgres(pool) => pg::list_databases(pool).await,
            Driver::MySql(_) | Driver::Sqlite(_) => Ok(Vec::new()),
        }
    }

    pub async fn describe_table(
        &self,
        namespace: &str,
        table: &str,
    ) -> AppResult<TableDescription> {
        match self {
            Driver::Postgres(pool) => pg::describe_table(pool, namespace, table).await,
            Driver::MySql(pool) => mysql::describe_table(pool, namespace, table).await,
            Driver::Sqlite(pool) => sqlite::describe_table(pool, namespace, table).await,
        }
    }

    /// A connection of its own, out of the pool.
    async fn acquire(&self) -> AppResult<PinnedConn> {
        Ok(match self {
            Driver::Postgres(pool) => PinnedConn::Postgres(pool.acquire().await.map_err(unpooled)?),
            Driver::MySql(pool) => PinnedConn::MySql(pool.acquire().await.map_err(unpooled)?),
            Driver::Sqlite(pool) => PinnedConn::Sqlite(pool.acquire().await.map_err(unpooled)?),
        })
    }

    /// Takes the editor's connection out of the pool, with what a cancel reaches.
    pub async fn pin(&self) -> AppResult<(PinnedConn, CancelTarget)> {
        let mut conn = self.acquire().await?;
        let target = conn.cancel_target().await?;
        Ok((conn, target))
    }

    /// Runs a batch on any pooled connection rather than the editor's, for reads
    /// that must not queue behind a running editor query (the table view).
    pub async fn run(
        &self,
        statements: &[Statement],
        limit: usize,
    ) -> AppResult<Vec<StatementResult>> {
        Ok(self.acquire().await?.run(statements, limit).await.results)
    }

    /// Stops whatever the pinned connection is running; the statement then fails
    /// with the engine's own cancel error and the connection stays usable. The
    /// server is asked over another pooled connection.
    pub async fn cancel(&self, target: &CancelTarget) -> AppResult<()> {
        let result = match (self, target) {
            (_, CancelTarget::Interrupt(flag)) => {
                flag.store(true, Ordering::Relaxed);
                Ok(())
            }
            (Driver::Postgres(pool), CancelTarget::Backend(pid)) => {
                sqlx::query("SELECT pg_cancel_backend($1)")
                    .bind(*pid as i32)
                    .execute(pool)
                    .await
                    .map(drop)
            }
            // KILL takes no bind parameter; the id is a number we read ourselves.
            (Driver::MySql(pool), CancelTarget::Backend(id)) => {
                sqlx::query(AssertSqlSafe(format!("KILL QUERY {id}")))
                    .execute(pool)
                    .await
                    .map(drop)
            }
            (Driver::Sqlite(_), CancelTarget::Backend(_)) => Ok(()),
        };
        result.map_err(AppError::internal)
    }

    /// The engine this driver speaks (for quoting/dialect decisions in services).
    pub fn engine(&self) -> Engine {
        match self {
            Driver::Postgres(_) => Engine::Postgres,
            Driver::MySql(_) => Engine::MySql,
            Driver::Sqlite(_) => Engine::Sqlite,
        }
    }

    /// Applies a batch of staged grid edits in one transaction. The row-identity
    /// (`key_columns`) and column types are resolved by `grid_service`; binding is
    /// the reverse of `values.rs` decode. Any failure rolls the whole batch back.
    pub async fn commit_grid(
        &self,
        namespace: &str,
        table: &str,
        key_columns: &[String],
        types_map: &HashMap<String, String>,
        edits: &[GridEdit],
    ) -> AppResult<GridCommitResult> {
        let write = grid::GridWrite {
            engine: self.engine(),
            namespace,
            table,
            key_columns,
            types: types_map,
            edits,
        };
        match self {
            Driver::Postgres(pool) => grid::commit(pool, &write, pg::bind_cell).await,
            Driver::MySql(pool) => grid::commit(pool, &write, mysql::bind_cell).await,
            Driver::Sqlite(pool) => grid::commit(pool, &write, sqlite::bind_cell).await,
        }
    }

    /// Re-runs `sql` and streams its full result into `sink` (CSV/JSON export).
    /// Returns the row count. No row limit — the caller controls memory via the sink.
    pub async fn export_rows(
        &self,
        sql: &str,
        sink: &mut (dyn export::RowSink + Send),
    ) -> AppResult<u64> {
        match self {
            Driver::Postgres(pool) => {
                export::stream(pool, sql, pg::columns, pg::decode_row, sink).await
            }
            Driver::MySql(pool) => {
                export::stream(pool, sql, mysql::columns, mysql::decode_row, sink).await
            }
            Driver::Sqlite(pool) => {
                export::stream(pool, sql, sqlite::columns, sqlite::decode_row, sink).await
            }
        }
    }

    /// Imports `rows` into a table with the given conflict handling, in one
    /// transaction. `first_line` is the CSV line of `rows[0]` (for error reports);
    /// `progress` hears the running row count after each batch.
    #[allow(clippy::too_many_arguments)]
    pub async fn import_rows(
        &self,
        namespace: &str,
        table: &str,
        columns: &[String],
        pk: &[String],
        conflict: ConflictMode,
        types_map: &HashMap<String, String>,
        rows: &[Vec<CellValue>],
        first_line: usize,
        progress: &(dyn Fn(u64) + Send + Sync),
    ) -> AppResult<ImportResult> {
        let plan = import::ImportPlan {
            engine: self.engine(),
            namespace,
            table,
            columns,
            pk,
            conflict,
            types: types_map,
        };
        let inserted = match self {
            Driver::Postgres(pool) => {
                import::run(pool, &plan, rows, first_line, pg::bind_cell, progress).await?
            }
            Driver::MySql(pool) => {
                import::run(pool, &plan, rows, first_line, mysql::bind_cell, progress).await?
            }
            Driver::Sqlite(pool) => {
                import::run(pool, &plan, rows, first_line, sqlite::bind_cell, progress).await?
            }
        };
        Ok(ImportResult { inserted })
    }

    /// Release the connection(s). Called on explicit disconnect and after a
    /// successful `test_connection`.
    pub async fn close(&self) {
        match self {
            Driver::Postgres(pool) => pool.close().await,
            Driver::MySql(pool) => pool.close().await,
            Driver::Sqlite(pool) => pool.close().await,
        }
    }
}

/// A connection that could not be had or set up is the user's to see — the
/// server refused it, or its pool is closed — not a bug in Basalt.
fn unpooled(e: sqlx::Error) -> AppError {
    AppError::QueryError {
        message: e.to_string(),
        detail: None,
    }
}
