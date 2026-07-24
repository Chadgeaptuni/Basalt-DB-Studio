//! Thin query command handlers: deserialize, call the service, map the error.

use tauri::State;

use crate::drivers::types::RunResult;
use crate::services::query_service;
use crate::state::AppState;
use crate::AppResult;

/// Runs `sql` for a session. `cursor_offset` (run-at-cursor) picks the containing
/// statement; otherwise every statement in `sql` runs. `confirmed` re-runs past
/// the destructive-statement gate.
#[tauri::command]
pub async fn run_query(
    session_id: String,
    sql: String,
    cursor_offset: Option<usize>,
    confirmed: bool,
    limit: Option<usize>,
    state: State<'_, AppState>,
) -> AppResult<RunResult> {
    query_service::run(
        &session_id,
        &sql,
        cursor_offset,
        confirmed,
        limit,
        &state.sessions,
    )
    .await
}
