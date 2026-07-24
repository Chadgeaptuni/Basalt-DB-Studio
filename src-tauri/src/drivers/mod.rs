//! The `Driver` enum is the single match-dispatch site for engine differences —
//! no `dyn` traits (enum dispatch keeps the bundle lean and the branches
//! explicit). Only the `Sqlite` variant exists in this slice; `Pg`/`MySql`
//! variants are added when those engines land so there are no dead placeholders.
//!
//! Cloning a `Driver` clones the underlying sqlx pool handle (an `Arc`), which
//! lets a caller lift the driver out of the session registry under a short lock
//! and then await the database without holding it.

mod sqlite;
pub mod types;

use sqlx::SqlitePool;

use crate::AppResult;
use types::{SchemaTree, TableDescription};

#[derive(Clone)]
pub enum Driver {
    Sqlite(SqlitePool),
}

impl Driver {
    pub async fn introspect(&self) -> AppResult<SchemaTree> {
        match self {
            Driver::Sqlite(pool) => sqlite::introspect(pool).await,
        }
    }

    pub async fn describe_table(
        &self,
        namespace: &str,
        table: &str,
    ) -> AppResult<TableDescription> {
        match self {
            Driver::Sqlite(pool) => sqlite::describe_table(pool, namespace, table).await,
        }
    }

    /// Release the connection(s). Called on explicit disconnect and after a
    /// successful `test_connection`.
    pub async fn close(&self) {
        match self {
            Driver::Sqlite(pool) => pool.close().await,
        }
    }
}
