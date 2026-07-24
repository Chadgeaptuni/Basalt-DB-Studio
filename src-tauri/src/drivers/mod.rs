//! The `Driver` enum is the single match-dispatch site for engine differences —
//! no `dyn` traits (enum dispatch keeps the bundle lean and the branches
//! explicit). One variant per supported engine; each holds its sqlx pool.
//!
//! Cloning a `Driver` clones the underlying sqlx pool handle (an `Arc`), which
//! lets a caller lift the driver out of the session registry under a short lock
//! and then await the database without holding it.

mod mysql;
mod pg;
mod sqlite;
pub mod types;

use sqlx::{MySqlPool, PgPool, SqlitePool};

use crate::AppResult;
use types::{SchemaTree, TableDescription};

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
