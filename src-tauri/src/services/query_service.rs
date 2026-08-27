//! Runs SQL for a session: split → gate → execute. The gates (destructive-
//! statement confirmation, read-only enforcement) run in Rust before any
//! statement touches the database. Splitting also runs here, never in the editor.
//!
//! v1 scope: each run executes on one pooled connection (batch-level tx safety).
//! A pinned per-session connection for cross-run transactions, cancellation, and
//! statement timeouts are the next M2 increment — so `tx_status` is reported as
//! `Idle` (an unclosed tx in a batch is rolled back when the connection returns).

use serde_json::json;

use crate::drivers::types::{RunResult, TxStatus};
use crate::services::connection_service::{self, SessionRegistry};
use crate::sqlgen;
use crate::{AppError, AppResult};

/// Default fetch-side row cap (spec: 500, configurable per call).
const DEFAULT_ROW_LIMIT: usize = 500;

pub async fn run(
    session_id: &str,
    sql: &str,
    cursor_offset: Option<usize>,
    confirmed: bool,
    limit: Option<usize>,
    registry: &SessionRegistry,
) -> AppResult<RunResult> {
    let (driver, read_only) = connection_service::session_driver(session_id, registry).await?;

    // Run-at-cursor sends the whole buffer + a cursor offset; run-all/run-selection
    // sends the text to run. Either way splitting happens here.
    let statements = match cursor_offset {
        Some(offset) => sqlgen::statement_at(sql, offset).into_iter().collect(),
        None => sqlgen::split(sql),
    };
    if statements.is_empty() {
        return Ok(RunResult {
            statements: Vec::new(),
            tx_status: TxStatus::Idle,
        });
    }

    // Read-only gate (first layer; the engine-level read-only session is the
    // second). Reject the whole run so nothing partial executes.
    if read_only {
        if let Some(bad) = statements.iter().find(|s| !sqlgen::is_read_only(&s.text)) {
            return Err(AppError::ReadOnlyViolation(format!(
                "connection is read-only; refused: {}",
                first_line(&bad.text)
            )));
        }
    }

    // Confirmation gate: any destructive statement stops the run until the caller
    // re-invokes with `confirmed: true`. `detail` lists what would run.
    if !confirmed {
        let flagged: Vec<_> = statements
            .iter()
            .enumerate()
            .filter_map(|(index, s)| {
                sqlgen::confirmation_reason(&s.text)
                    .map(|reason| json!({ "index": index, "statement": s.text, "reason": reason }))
            })
            .collect();
        if !flagged.is_empty() {
            return Err(AppError::ConfirmationRequired {
                detail: json!({ "statements": flagged }),
            });
        }
    }

    let results = driver
        .run(&statements, limit.unwrap_or(DEFAULT_ROW_LIMIT))
        .await?;

    Ok(RunResult {
        statements: results,
        tx_status: TxStatus::Idle,
    })
}

/// First non-empty line of a statement, for concise error messages.
fn first_line(text: &str) -> &str {
    text.lines().next().unwrap_or(text).trim()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::connections::ConnectionProfile;
    use crate::drivers::types::{CellValue, Engine};
    use std::collections::HashMap;
    use tokio::sync::Mutex;

    async fn sqlite_session(read_only: bool) -> (String, SessionRegistry) {
        use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
        let path = std::env::temp_dir()
            .join(format!("basalt-q-{}.db", uuid::Uuid::new_v4()))
            .to_string_lossy()
            .into_owned();
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(
                SqliteConnectOptions::new()
                    .filename(&path)
                    .create_if_missing(true),
            )
            .await
            .unwrap();
        sqlx::query("CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT)")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("INSERT INTO t (id, name) VALUES (1, 'a'), (2, 'b')")
            .execute(&pool)
            .await
            .unwrap();
        pool.close().await;

        let profile = ConnectionProfile {
            id: "q".into(),
            name: "q".into(),
            engine: Engine::Sqlite,
            environment: None,
            host: None,
            port: None,
            database: None,
            username: None,
            file_path: Some(path),
            read_only,
            connect_timeout_secs: Some(5),
            secret_ref: None,
            tls: None,
            ssh: None,
        };
        let registry: SessionRegistry = Mutex::new(HashMap::new());
        let info = connection_service::connect(&profile, None, None, &registry)
            .await
            .unwrap();
        (info.session_id, registry)
    }

    #[tokio::test]
    async fn runs_select_and_decodes_rows() {
        let (sid, reg) = sqlite_session(false).await;
        let out = run(
            &sid,
            "SELECT id, name FROM t ORDER BY id",
            None,
            false,
            None,
            &reg,
        )
        .await
        .unwrap();
        assert_eq!(out.statements.len(), 1);
        let r = &out.statements[0];
        assert_eq!(
            r.columns
                .iter()
                .map(|c| c.name.as_str())
                .collect::<Vec<_>>(),
            ["id", "name"]
        );
        assert_eq!(r.rows.len(), 2);
        assert_eq!(r.rows[0][0], CellValue::Int(1));
        assert_eq!(r.rows[1][1], CellValue::Text("b".into()));
        assert!(r.error.is_none());
    }

    #[tokio::test]
    async fn row_limit_truncates() {
        let (sid, reg) = sqlite_session(false).await;
        let out = run(
            &sid,
            "SELECT * FROM t ORDER BY id",
            None,
            false,
            Some(1),
            &reg,
        )
        .await
        .unwrap();
        assert_eq!(out.statements[0].rows.len(), 1);
        assert!(out.statements[0].truncated);
    }

    #[tokio::test]
    async fn destructive_statement_needs_confirmation() {
        let (sid, reg) = sqlite_session(false).await;
        let err = run(&sid, "DROP TABLE t", None, false, None, &reg)
            .await
            .unwrap_err();
        assert_eq!(err.kind(), "confirmationRequired");
        // With confirmed=true it proceeds (and succeeds).
        run(&sid, "DROP TABLE t", None, true, None, &reg)
            .await
            .unwrap();
    }

    #[tokio::test]
    async fn read_only_connection_rejects_writes() {
        let (sid, reg) = sqlite_session(true).await;
        let err = run(
            &sid,
            "INSERT INTO t (id) VALUES (3)",
            None,
            false,
            None,
            &reg,
        )
        .await
        .unwrap_err();
        assert_eq!(err.kind(), "readOnlyViolation");
        // Reads still work on a read-only connection.
        run(&sid, "SELECT 1", None, false, None, &reg)
            .await
            .unwrap();
    }

    #[tokio::test]
    async fn failing_statement_carries_its_error() {
        let (sid, reg) = sqlite_session(false).await;
        let out = run(&sid, "SELECT * FROM nope", None, false, None, &reg)
            .await
            .unwrap();
        assert_eq!(out.statements.len(), 1);
        assert_eq!(out.statements[0].error.as_ref().unwrap().kind, "queryError");
    }
}
