//! Git-sync commands. The git calls block (subprocess + network), so they run on
//! a blocking thread; the config dir is the repo. Logic lives in `gitsync`.

use tauri::State;

use crate::gitsync::{self, GitStatus, SyncOutcome};
use crate::state::AppState;
use crate::{AppError, AppResult};

#[tauri::command]
pub async fn git_status(state: State<'_, AppState>) -> AppResult<GitStatus> {
    let dir = state.paths.config_dir.clone();
    tokio::task::spawn_blocking(move || gitsync::status(&dir))
        .await
        .map_err(AppError::internal)?
}

#[tauri::command]
pub async fn git_sync(state: State<'_, AppState>) -> AppResult<SyncOutcome> {
    let dir = state.paths.config_dir.clone();
    tokio::task::spawn_blocking(move || gitsync::sync(&dir, "Basalt DB Studio sync"))
        .await
        .map_err(AppError::internal)?
}
