//! Export command: stream a query's full result to a file, reporting progress over
//! an `ipc::Channel` (the officially-supported high-throughput path, not events).

use tauri::ipc::Channel;
use tauri::State;

use crate::drivers::types::{ExportFormat, ExportProgress};
use crate::services::export_service;
use crate::state::AppState;
use crate::AppResult;

#[tauri::command]
pub async fn export_query(
    session_id: String,
    sql: String,
    format: ExportFormat,
    path: String,
    on_progress: Channel<ExportProgress>,
    state: State<'_, AppState>,
) -> AppResult<u64> {
    let channel = on_progress.clone();
    let progress = move |rows: u64| {
        let _ = channel.send(ExportProgress { rows, done: false });
    };
    let total =
        export_service::export(&session_id, &sql, format, &path, &progress, &state.sessions)
            .await?;
    let _ = on_progress.send(ExportProgress {
        rows: total,
        done: true,
    });
    Ok(total)
}
