//! Import command: load a CSV into a table with a conflict mode. Type/parse errors
//! come back as `importParse` with the offending line.

use tauri::State;

use crate::drivers::types::{ConflictMode, ImportResult};
use crate::services::import_service;
use crate::state::AppState;
use crate::AppResult;

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn import_csv(
    session_id: String,
    namespace: String,
    table: String,
    columns: Vec<String>,
    has_header: bool,
    conflict: ConflictMode,
    path: String,
    state: State<'_, AppState>,
) -> AppResult<ImportResult> {
    import_service::import(
        &session_id,
        &namespace,
        &table,
        columns,
        has_header,
        conflict,
        &path,
        &state.sessions,
    )
    .await
}
