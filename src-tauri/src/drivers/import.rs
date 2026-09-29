//! CSV import: parsed rows become multi-row parameterized INSERTs with the
//! engine's native conflict handling, all inside one transaction. A row the
//! engine rejects (type mismatch, constraint) rolls the import back and is
//! reported by line (`importParse`). Binding reuses each engine's `values.rs` bind (a field is Text,
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

/// Bind parameters per statement stay under every engine's ceiling (pg and MySQL
/// 65535, SQLite 32766), and a batch never exceeds this many rows.
const MAX_PARAMS: usize = 30_000;
const MAX_ROWS: usize = 500;

/// Inserts `rows` in multi-row batches inside one transaction, reporting the
/// running count to `progress` after each batch. A batch the engine rejects is
/// rolled back to its savepoint and replayed one row at a time, so the error
/// still names the exact line.
pub async fn run<DB, Bind>(
    pool: &Pool<DB>,
    plan: &ImportPlan<'_>,
    rows: &[Vec<CellValue>],
    first_line: usize,
    bind: Bind,
    progress: &(dyn Fn(u64) + Send + Sync),
) -> AppResult<u64>
where
    DB: Database,
    DB::QueryResult: Affected,
    for<'c> &'c mut DB::Connection: Executor<'c, Database = DB>,
    DB::Arguments: IntoArguments<DB> + Default,
    Bind: Fn(&mut QueryBuilder<DB>, &CellValue, &str) + Copy,
{
    let suffix = conflict_suffix(plan)?;
    let per_batch = (MAX_PARAMS / plan.columns.len().max(1)).clamp(1, MAX_ROWS);

    let mut tx = pool.begin().await.map_err(AppError::internal)?;
    let mut inserted = 0u64;
    let mut done = 0usize;
    for batch in rows.chunks(per_batch) {
        (&mut *tx)
            .execute("SAVEPOINT basalt_import")
            .await
            .map_err(AppError::internal)?;
        match insert(plan, batch, &suffix, bind)
            .build()
            .execute(&mut *tx)
            .await
        {
            Ok(result) => inserted += result.affected(),
            Err(_) => {
                (&mut *tx)
                    .execute("ROLLBACK TO SAVEPOINT basalt_import")
                    .await
                    .map_err(AppError::internal)?;
                for (i, row) in batch.iter().enumerate() {
                    let one = std::slice::from_ref(row);
                    match insert(plan, one, &suffix, bind)
                        .build()
                        .execute(&mut *tx)
                        .await
                    {
                        Ok(result) => inserted += result.affected(),
                        Err(e) => {
                            tx.rollback().await.ok();
                            return Err(AppError::ImportParse {
                                message: match &e {
                                    sqlx::Error::Database(db) => db.message().to_string(),
                                    other => other.to_string(),
                                },
                                line: first_line + done + i,
                            });
                        }
                    }
                }
            }
        }
        done += batch.len();
        progress(done as u64);
    }
    tx.commit().await.map_err(AppError::internal)?;
    Ok(inserted)
}

/// One `INSERT … VALUES (…), (…)` for `rows`, with the conflict clause.
fn insert<DB, Bind>(
    plan: &ImportPlan<'_>,
    rows: &[Vec<CellValue>],
    suffix: &str,
    bind: Bind,
) -> QueryBuilder<DB>
where
    DB: Database,
    Bind: Fn(&mut QueryBuilder<DB>, &CellValue, &str),
{
    let col_list = plan
        .columns
        .iter()
        .map(|c| quote_ident(plan.engine, c))
        .collect::<Vec<_>>()
        .join(", ");
    let mut qb: QueryBuilder<DB> = QueryBuilder::new(insert_verb(plan.engine, plan.conflict));
    qb.push(" INTO ")
        .push(quote_qualified(plan.engine, plan.namespace, plan.table))
        .push(" (")
        .push(col_list)
        .push(") VALUES ");
    for (r, row) in rows.iter().enumerate() {
        qb.push(if r == 0 { "(" } else { ", (" });
        for (j, cell) in row.iter().enumerate() {
            if j > 0 {
                qb.push(", ");
            }
            bind(&mut qb, cell, type_of(plan, j));
        }
        qb.push(")");
    }
    qb.push(suffix);
    qb
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
