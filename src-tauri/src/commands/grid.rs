//! Thin grid command handlers: deserialize, call `grid_service`, map the error.

use tauri::State;

use crate::drivers::types::{BrowseResult, GridCommitResult, GridEdit};
use crate::services::grid_service;
use crate::state::AppState;
use crate::AppResult;

/// Loads the editable table-data view (a `limit + 1` window + row identity).
#[tauri::command]
pub async fn grid_browse(
    session_id: String,
    namespace: String,
    table: String,
    limit: Option<usize>,
    state: State<'_, AppState>,
) -> AppResult<BrowseResult> {
    grid_service::browse(&session_id, &namespace, &table, limit, &state.sessions).await
}

/// Commits a batch of staged edits in one transaction; any failure rolls back.
#[tauri::command]
pub async fn grid_commit(
    session_id: String,
    namespace: String,
    table: String,
    key_columns: Vec<String>,
    edits: Vec<GridEdit>,
    state: State<'_, AppState>,
) -> AppResult<GridCommitResult> {
    grid_service::commit(
        &session_id,
        &namespace,
        &table,
        key_columns,
        edits,
        &state.sessions,
    )
    .await
}
