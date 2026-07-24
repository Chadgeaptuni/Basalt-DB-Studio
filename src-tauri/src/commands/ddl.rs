//! Thin DDL command: generate the SQL for a structured request. Execution goes
//! through the normal `run_query` path (which owns the gates and schema refresh).

use tauri::State;

use crate::drivers::types::DdlRequest;
use crate::services::ddl_service;
use crate::state::AppState;
use crate::AppResult;

/// Returns the engine-specific SQL for a DDL request, for the preview modal.
#[tauri::command]
pub async fn ddl_generate(
    session_id: String,
    request: DdlRequest,
    state: State<'_, AppState>,
) -> AppResult<String> {
    ddl_service::generate(&session_id, &request, &state.sessions).await
}
