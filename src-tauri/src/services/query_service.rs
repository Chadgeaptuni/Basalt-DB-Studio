//! Runs SQL for a session: split → gate → execute. The gates (destructive-
//! statement confirmation, read-only enforcement) run in Rust before any
//! statement touches the database. Splitting also runs here, never in the editor.
//!
//! Every run goes through the session's pinned editor connection, one at a time,
//! so a transaction opened in one run is still open in the next. A run can be
//! cancelled, and a statement timeout cancels it through the same path.

use std::future::Future;
use std::time::Duration;

use serde_json::json;
use tokio::sync::Mutex;

use crate::drivers::types::{Engine, RunResult, StatementResult, TxStatus};
use crate::drivers::{Batch, CancelTarget, Driver, PinnedConn};
use crate::services::connection_service::{self, SessionRegistry};
use crate::sqlgen::{self, Statement, TxEffect};
use crate::{AppError, AppResult};

/// Default fetch-side row cap (spec: 500, configurable per call).
const DEFAULT_ROW_LIMIT: usize = 500;

/// A session's editor: its pinned connection and tx status, and what a cancel
/// reaches while a run holds that connection.
#[derive(Default)]
pub struct Editor {
    conn: Mutex<EditorConn>,
    /// Readable without the run's lock, which a running statement holds.
    target: std::sync::Mutex<Option<CancelTarget>>,
}

#[derive(Default)]
struct EditorConn {
    pinned: Option<PinnedConn>,
    tx: TxStatus,
}

impl Editor {
    fn target(&self) -> Option<CancelTarget> {
        self.target
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clone()
    }

    fn set_target(&self, target: Option<CancelTarget>) {
        *self.target.lock().unwrap_or_else(|e| e.into_inner()) = target;
    }
}

#[allow(clippy::too_many_arguments)]
pub async fn run(
    session_id: &str,
    sql: &str,
    cursor_offset: Option<usize>,
    confirmed: bool,
    limit: Option<usize>,
    timeout: Option<Duration>,
    registry: &SessionRegistry,
) -> AppResult<RunResult> {
    let (driver, read_only, editor) =
        connection_service::session_editor(session_id, registry).await?;

    // Run-at-cursor sends the whole buffer + a cursor offset; run-all/run-selection
    // sends the text to run. Either way splitting happens here.
    let statements: Vec<Statement> = match cursor_offset {
        Some(offset) => sqlgen::statement_at(sql, offset).into_iter().collect(),
        None => sqlgen::split(sql),
    };

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

    // One run at a time per session: they share the one connection.
    let mut conn = editor.conn.lock().await;
    if statements.is_empty() {
        return Ok(RunResult {
            statements: Vec::new(),
            tx_status: conn.tx,
        });
    }
    if conn.pinned.is_none() {
        let (pinned, target) = driver.pin().await?;
        editor.set_target(Some(target));
        conn.pinned = Some(pinned);
    }
    if let Some(target) = editor.target() {
        target.arm();
    }
    let pinned = conn.pinned.as_mut().expect("pinned above");
    let run = pinned.run(&statements, limit.unwrap_or(DEFAULT_ROW_LIMIT));
    let batch = with_timeout(&driver, &editor, timeout, run).await?;

    conn.tx = next_tx(driver.engine(), conn.tx, &statements, &batch.results);
    // Below the SQL layer something failed: the connection's state is unknown, so
    // it is closed rather than trusted with the next run, and its tx goes with it.
    if batch.broken {
        if let Some(pinned) = conn.pinned.take() {
            pinned.discard();
        }
        editor.set_target(None);
        conn.tx = TxStatus::Idle;
    }
    Ok(RunResult {
        statements: batch.results,
        tx_status: conn.tx,
    })
}

/// Stops the session's running statement, if any. A no-op when nothing runs.
pub async fn cancel(session_id: &str, registry: &SessionRegistry) -> AppResult<()> {
    let (driver, _, editor) = connection_service::session_editor(session_id, registry).await?;
    stop(&driver, &editor).await
}

/// The statement ends with the engine's own cancel error; the connection and
/// any open transaction survive (Postgres marks the transaction failed).
pub(crate) async fn stop(driver: &Driver, editor: &Editor) -> AppResult<()> {
    match editor.target() {
        Some(target) => driver.cancel(&target).await,
        None => Ok(()),
    }
}

/// Runs `run` to completion, cancelling it through `stop` if it outlives `timeout`.
async fn with_timeout(
    driver: &Driver,
    editor: &Editor,
    timeout: Option<Duration>,
    run: impl Future<Output = Batch>,
) -> AppResult<Batch> {
    let Some(limit) = timeout else {
        return Ok(run.await);
    };
    tokio::pin!(run);
    if let Ok(batch) = tokio::time::timeout(limit, &mut run).await {
        return Ok(batch);
    }
    stop(driver, editor).await?;
    let mut batch = run.await;
    let reason = format!(
        "Statement timeout ({}s) reached; the statement was cancelled.",
        limit.as_secs()
    );
    for error in batch.results.iter_mut().filter_map(|r| r.error.as_mut()) {
        if error.kind == "queryCancelled" {
            error.message = reason.clone();
        }
    }
    Ok(batch)
}

/// The tx state after a run: BEGIN opens, COMMIT/ROLLBACK (and MySQL DDL) close,
/// and a failure inside a Postgres tx aborts it until the next ROLLBACK.
fn next_tx(
    engine: Engine,
    mut tx: TxStatus,
    statements: &[Statement],
    results: &[StatementResult],
) -> TxStatus {
    for (stmt, result) in statements.iter().zip(results) {
        if result.error.is_some() {
            if engine == Engine::Postgres && tx == TxStatus::InTx {
                tx = TxStatus::Error;
            }
            break;
        }
        tx = match sqlgen::tx_effect(&stmt.text, engine) {
            TxEffect::Begin => TxStatus::InTx,
            TxEffect::End => TxStatus::Idle,
            TxEffect::None => tx,
        };
    }
    tx
}

/// First non-empty line of a statement, for concise error messages.
fn first_line(text: &str) -> &str {
    text.lines().next().unwrap_or(text).trim()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::connections::ConnectionProfile;
    use crate::drivers::types::CellValue;
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
        let info = connection_service::connect(&profile, None, None, None, &registry)
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
            None,
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
        let err = run(&sid, "DROP TABLE t", None, false, None, None, &reg)
            .await
            .unwrap_err();
        assert_eq!(err.kind(), "confirmationRequired");
        // With confirmed=true it proceeds (and succeeds).
        run(&sid, "DROP TABLE t", None, true, None, None, &reg)
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
            None,
            &reg,
        )
        .await
        .unwrap_err();
        assert_eq!(err.kind(), "readOnlyViolation");
        // Reads still work on a read-only connection.
        run(&sid, "SELECT 1", None, false, None, None, &reg)
            .await
            .unwrap();
    }

    #[tokio::test]
    async fn failing_statement_carries_its_error() {
        let (sid, reg) = sqlite_session(false).await;
        let out = run(&sid, "SELECT * FROM nope", None, false, None, None, &reg)
            .await
            .unwrap();
        assert_eq!(out.statements.len(), 1);
        assert_eq!(out.statements[0].error.as_ref().unwrap().kind, "queryError");
    }

    /// Counts to a billion: seconds of work, so a cancel lands mid-statement.
    const SLOW: &str = "WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM c \
        WHERE x < 1000000000) SELECT count(*) FROM c";

    async fn run_sql(sid: &str, sql: &str, reg: &SessionRegistry) -> RunResult {
        run(sid, sql, None, true, None, None, reg).await.unwrap()
    }

    #[tokio::test]
    async fn a_transaction_stays_open_across_runs() {
        let (sid, reg) = sqlite_session(false).await;

        assert_eq!(run_sql(&sid, "BEGIN", &reg).await.tx_status, TxStatus::InTx);
        let insert = run_sql(&sid, "INSERT INTO t (id, name) VALUES (3, 'c')", &reg).await;
        assert_eq!(insert.tx_status, TxStatus::InTx);
        assert_eq!(
            run_sql(&sid, "ROLLBACK", &reg).await.tx_status,
            TxStatus::Idle
        );

        let count = run_sql(&sid, "SELECT count(*) FROM t", &reg).await;
        assert_eq!(count.statements[0].rows[0][0], CellValue::Int(2));
    }

    #[tokio::test]
    async fn an_empty_result_keeps_its_column_headers() {
        let (sid, reg) = sqlite_session(false).await;
        let out = run_sql(&sid, "SELECT id, name FROM t WHERE id < 0", &reg).await;
        let names: Vec<_> = out.statements[0]
            .columns
            .iter()
            .map(|c| c.name.as_str())
            .collect();
        assert_eq!(names, ["id", "name"]);
        assert!(out.statements[0].rows.is_empty());
    }

    #[tokio::test]
    async fn cancel_stops_the_running_statement_and_keeps_the_session() {
        let (sid, reg) = sqlite_session(false).await;
        // Pin first, so the cancel below has a connection to reach.
        run_sql(&sid, "SELECT 1", &reg).await;

        let (out, cancelled) = tokio::join!(run_sql(&sid, SLOW, &reg), async {
            tokio::time::sleep(Duration::from_millis(100)).await;
            cancel(&sid, &reg).await
        });
        cancelled.unwrap();
        assert_eq!(
            out.statements[0].error.as_ref().unwrap().kind,
            "queryCancelled"
        );

        // The interrupt is cleared, so the next run is not born cancelled.
        assert!(run_sql(&sid, "SELECT 1", &reg).await.statements[0]
            .error
            .is_none());
    }

    #[tokio::test]
    async fn a_statement_timeout_cancels_through_the_same_path() {
        let (sid, reg) = sqlite_session(false).await;
        let out = run(
            &sid,
            SLOW,
            None,
            true,
            None,
            Some(Duration::from_millis(100)),
            &reg,
        )
        .await
        .unwrap();
        let error = out.statements[0].error.as_ref().unwrap();
        assert_eq!(error.kind, "queryCancelled");
        assert!(
            error.message.starts_with("Statement timeout"),
            "{}",
            error.message
        );
    }

    fn stmt(text: &str) -> Statement {
        Statement {
            start: 0,
            end: text.len(),
            text: text.into(),
        }
    }

    fn ok() -> StatementResult {
        StatementResult {
            columns: Vec::new(),
            rows: Vec::new(),
            rows_affected: 0,
            truncated: false,
            duration_ms: 0,
            error: None,
        }
    }

    fn failed() -> StatementResult {
        StatementResult {
            error: Some(crate::drivers::types::StatementError {
                kind: "queryError".into(),
                message: "boom".into(),
                detail: None,
            }),
            ..ok()
        }
    }

    #[test]
    fn a_failure_inside_a_postgres_tx_aborts_it_until_rollback() {
        let pg = Engine::Postgres;
        let aborted = next_tx(pg, TxStatus::InTx, &[stmt("SELECT x")], &[failed()]);
        assert_eq!(aborted, TxStatus::Error);
        assert_eq!(
            next_tx(pg, aborted, &[stmt("ROLLBACK")], &[ok()]),
            TxStatus::Idle
        );
        // MySQL and SQLite keep the tx open after a failed statement.
        let my = next_tx(
            Engine::MySql,
            TxStatus::InTx,
            &[stmt("SELECT x")],
            &[failed()],
        );
        assert_eq!(my, TxStatus::InTx);
    }

    #[test]
    fn statements_after_a_failure_do_not_count() {
        let tx = next_tx(
            Engine::Sqlite,
            TxStatus::Idle,
            &[stmt("SELECT x"), stmt("BEGIN")],
            &[failed()],
        );
        assert_eq!(tx, TxStatus::Idle);
    }
}
