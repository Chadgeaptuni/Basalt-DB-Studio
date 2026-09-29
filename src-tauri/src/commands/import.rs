//! Import command: load a CSV into a table with a conflict mode. Type/parse errors
//! come back as `importParse` with the offending line; the running row count
//! streams over `on_progress`.

use tauri::ipc::Channel;
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
    mapping: Vec<Option<String>>,
    has_header: bool,
    conflict: ConflictMode,
    path: String,
    on_progress: Channel<u64>,
    state: State<'_, AppState>,
) -> AppResult<ImportResult> {
    import_service::import(
        &session_id,
        &namespace,
        &table,
        mapping,
        has_header,
        conflict,
        &path,
        &|rows| {
            let _ = on_progress.send(rows);
        },
        &state.sessions,
    )
    .await
}

/// The CSV's first record, for mapping its fields to columns.
#[tauri::command]
pub fn csv_header(path: String) -> AppResult<Vec<String>> {
    import_service::header(&path)
}
