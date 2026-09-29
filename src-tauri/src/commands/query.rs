//! Thin query command handlers: deserialize, call the service, map the error.

use std::time::Duration;

use tauri::State;

use crate::drivers::types::RunResult;
use crate::services::query_service;
use crate::state::AppState;
use crate::AppResult;

/// Runs `sql` for a session. `cursor_offset` (run-at-cursor) picks the containing
/// statement; otherwise every statement in `sql` runs. `confirmed` re-runs past
/// the destructive-statement gate; `timeout_secs` cancels a run that outlives it.
#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub async fn run_query(
    session_id: String,
    sql: String,
    cursor_offset: Option<usize>,
    confirmed: bool,
    limit: Option<usize>,
    timeout_secs: Option<u64>,
    state: State<'_, AppState>,
) -> AppResult<RunResult> {
    query_service::run(
        &session_id,
        &sql,
        cursor_offset,
        confirmed,
        limit,
        timeout_secs.filter(|&s| s > 0).map(Duration::from_secs),
        &state.sessions,
    )
    .await
}

/// Stops the session's running statement, if any.
#[tauri::command]
pub async fn cancel_query(session_id: String, state: State<'_, AppState>) -> AppResult<()> {
    query_service::cancel(&session_id, &state.sessions).await
}
