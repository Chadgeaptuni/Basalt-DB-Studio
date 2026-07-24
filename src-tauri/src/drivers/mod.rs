//! The `Driver` enum is the single match-dispatch site for engine differences —
//! no `dyn` traits (enum dispatch keeps the bundle lean and the branches
//! explicit). One variant per supported engine; each holds its sqlx pool.
//!
//! Cloning a `Driver` clones the underlying sqlx pool handle (an `Arc`), which
//! lets a caller lift the driver out of the session registry under a short lock
//! and then await the database without holding it.

mod exec;
mod grid;
mod mysql;
mod pg;
mod sqlite;
pub mod types;

use std::collections::HashMap;

use sqlx::{MySqlPool, PgPool, SqlitePool};

use crate::sqlgen::Statement;
use crate::AppResult;
use types::{Engine, GridCommitResult, GridEdit, SchemaTree, StatementResult, TableDescription};

#[derive(Clone)]
pub enum Driver {
    Postgres(PgPool),
    MySql(MySqlPool),
    Sqlite(SqlitePool),
}

impl Driver {
    pub async fn introspect(&self) -> AppResult<SchemaTree> {
        match self {
            Driver::Postgres(pool) => pg::introspect(pool).await,
            Driver::MySql(pool) => mysql::introspect(pool).await,
            Driver::Sqlite(pool) => sqlite::introspect(pool).await,
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

    /// Runs a pre-split batch of statements on one pooled connection, buffering
    /// up to `limit` rows per statement. Stops at the first failure (its error is
    /// carried on that statement's result). Confirmation and read-only gates are
    /// applied by the query service before this is called.
    pub async fn run(
        &self,
        statements: &[Statement],
        limit: usize,
    ) -> AppResult<Vec<StatementResult>> {
        match self {
            Driver::Postgres(pool) => {
                exec::run_batch(pool, statements, limit, pg::columns, pg::decode_row).await
            }
            Driver::MySql(pool) => {
                exec::run_batch(pool, statements, limit, mysql::columns, mysql::decode_row).await
            }
            Driver::Sqlite(pool) => {
                exec::run_batch(pool, statements, limit, sqlite::columns, sqlite::decode_row).await
            }
        }
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
