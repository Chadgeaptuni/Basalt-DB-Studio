//! CSV import: each parsed row becomes a parameterized INSERT with the engine's
//! native conflict handling, all inside one transaction. A row the engine rejects
//! (type mismatch, constraint) rolls the batch back and is reported by line
//! (`importParse`). Binding reuses each engine's `values.rs` bind (a field is Text,
//! or NULL when empty).

use std::collections::HashMap;

use sqlx::{Database, Executor, IntoArguments, Pool, QueryBuilder};

use super::exec::Affected;
use crate::drivers::types::{CellValue, ConflictMode, Engine};
use crate::sqlgen::{quote_ident, quote_qualified};
use crate::{AppError, AppResult};

pub struct ImportPlan<'a> {
    pub engine: Engine,
    pub namespace: &'a str,
    pub table: &'a str,
    pub columns: &'a [String],
    pub pk: &'a [String],
    pub conflict: ConflictMode,
    pub types: &'a HashMap<String, String>,
}

pub async fn run<DB, Bind>(
    pool: &Pool<DB>,
    plan: &ImportPlan<'_>,
    rows: &[Vec<CellValue>],
    first_line: usize,
    bind: Bind,
) -> AppResult<u64>
where
    DB: Database,
    DB::QueryResult: Affected,
    for<'c> &'c mut DB::Connection: Executor<'c, Database = DB>,
    DB::Arguments: IntoArguments<DB> + Default,
    Bind: Fn(&mut QueryBuilder<DB>, &CellValue, &str) + Copy,
{
    let qualified = quote_qualified(plan.engine, plan.namespace, plan.table);
    let verb = insert_verb(plan.engine, plan.conflict);
    let col_list = plan
        .columns
        .iter()
        .map(|c| quote_ident(plan.engine, c))
        .collect::<Vec<_>>()
        .join(", ");
    let suffix = conflict_suffix(plan)?;

    let mut tx = pool.begin().await.map_err(AppError::internal)?;
    let mut inserted = 0u64;
    for (i, row) in rows.iter().enumerate() {
        let mut qb: QueryBuilder<DB> = QueryBuilder::new("");
        qb.push(verb)
            .push(" INTO ")
            .push(&qualified)
            .push(" (")
            .push(&col_list)
            .push(") VALUES (");
        for (j, cell) in row.iter().enumerate() {
            if j > 0 {
                qb.push(", ");
            }
            bind(&mut qb, cell, type_of(plan, j));
        }
        qb.push(")").push(&suffix);

        match qb.build().execute(&mut *tx).await {
            Ok(result) => inserted += result.affected(),
            Err(e) => {
                tx.rollback().await.ok();
                return Err(AppError::ImportParse {
                    message: match &e {
                        sqlx::Error::Database(db) => db.message().to_string(),
                        other => other.to_string(),
                    },
                    line: first_line + i,
                });
            }
        }
    }
    tx.commit().await.map_err(AppError::internal)?;
    Ok(inserted)
}

fn type_of<'a>(plan: &'a ImportPlan<'_>, col_index: usize) -> &'a str {
    plan.columns
        .get(col_index)
        .and_then(|c| plan.types.get(c))
        .map(String::as_str)
        .unwrap_or("")
}

/// The INSERT verb — skip-mode is a verb modifier on MySQL/SQLite.
fn insert_verb(engine: Engine, conflict: ConflictMode) -> &'static str {
    match (engine, conflict) {
        (Engine::MySql, ConflictMode::Skip) => "INSERT IGNORE",
        (Engine::Sqlite, ConflictMode::Skip) => "INSERT OR IGNORE",
        _ => "INSERT",
    }
}

/// The trailing conflict clause (pg uses `ON CONFLICT`; MySQL upsert uses
/// `ON DUPLICATE KEY UPDATE`). pg/SQLite upsert need the PK as the conflict target.
fn conflict_suffix(plan: &ImportPlan<'_>) -> AppResult<String> {
    let non_pk: Vec<&String> = plan
        .columns
        .iter()
        .filter(|c| !plan.pk.contains(c))
        .collect();
    match plan.conflict {
        ConflictMode::Insert => Ok(String::new()),
        ConflictMode::Skip => match plan.engine {
            Engine::Postgres => Ok(" ON CONFLICT DO NOTHING".into()),
            // MySQL/SQLite handle skip via the verb.
            Engine::MySql | Engine::Sqlite => Ok(String::new()),
        },
        ConflictMode::Upsert => match plan.engine {
            Engine::MySql => {
                if non_pk.is_empty() {
                    return Err(AppError::internal(
                        "upsert needs a non-key column to update",
                    ));
                }
                let sets = non_pk
                    .iter()
                    .map(|c| {
                        let q = quote_ident(Engine::MySql, c);
                        format!("{q}=VALUES({q})")
                    })
                    .collect::<Vec<_>>()
                    .join(", ");
                Ok(format!(" ON DUPLICATE KEY UPDATE {sets}"))
            }
            Engine::Postgres | Engine::Sqlite => {
                if plan.pk.is_empty() {
                    return Err(AppError::NoPrimaryKey(
                        "upsert needs a primary key as the conflict target".into(),
                    ));
                }
                let target = plan
                    .pk
                    .iter()
                    .map(|c| quote_ident(plan.engine, c))
                    .collect::<Vec<_>>()
                    .join(", ");
                if non_pk.is_empty() {
                    return Ok(format!(" ON CONFLICT ({target}) DO NOTHING"));
                }
                // `excluded` is the proposed row in both pg and SQLite.
                let sets = non_pk
                    .iter()
                    .map(|c| {
                        let q = quote_ident(plan.engine, c);
                        format!("{q}=excluded.{q}")
                    })
                    .collect::<Vec<_>>()
                    .join(", ");
                Ok(format!(" ON CONFLICT ({target}) DO UPDATE SET {sets}"))
            }
        },
    }
}
