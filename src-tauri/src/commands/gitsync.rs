//! Git commands. Every one shells out to git — subprocess, and for three of them
//! the network — so they all run on a blocking thread. The repo is the config
//! dir; logic lives in `gitsync`.

use tauri::State;

use crate::gitsync::{self, Branch, Commit, FileEntry, GithubStatus, GitStatus, SyncOutcome};
use crate::state::AppState;
use crate::{AppError, AppResult};

/// Run a `gitsync` call against the config dir on the blocking pool.
///
/// A macro rather than a generic helper: each command needs a different closure
/// signature, and the alternative was thirteen copies of the same
/// `spawn_blocking(...).await.map_err(...)` sandwich.
macro_rules! blocking {
    ($state:expr, |$dir:ident| $body:expr) => {{
        let $dir = $state.paths.config_dir.clone();
        tokio::task::spawn_blocking(move || $body)
            .await
            .map_err(AppError::internal)?
    }};
}

#[tauri::command]
pub async fn git_status(state: State<'_, AppState>) -> AppResult<GitStatus> {
    blocking!(state, |dir| gitsync::status(&dir))
}

#[tauri::command]
pub async fn git_sync(state: State<'_, AppState>) -> AppResult<SyncOutcome> {
    blocking!(state, |dir| gitsync::sync(&dir, "Basalt DB Studio sync"))
}

#[tauri::command]
pub async fn git_stage(state: State<'_, AppState>, paths: Vec<String>) -> AppResult<()> {
    blocking!(state, |dir| gitsync::stage(&dir, &paths))
}

#[tauri::command]
pub async fn git_unstage(state: State<'_, AppState>, paths: Vec<String>) -> AppResult<()> {
    blocking!(state, |dir| gitsync::unstage(&dir, &paths))
}

/// Destructive: the frontend confirms before calling, because git keeps no copy.
#[tauri::command]
pub async fn git_discard(state: State<'_, AppState>, paths: Vec<String>) -> AppResult<()> {
    blocking!(state, |dir| gitsync::discard(&dir, &paths))
}

#[tauri::command]
pub async fn git_commit(state: State<'_, AppState>, message: String) -> AppResult<()> {
    blocking!(state, |dir| gitsync::commit(&dir, &message))
}

#[tauri::command]
pub async fn git_fetch(state: State<'_, AppState>) -> AppResult<()> {
    blocking!(state, |dir| gitsync::fetch(&dir))
}

#[tauri::command]
pub async fn git_pull(state: State<'_, AppState>) -> AppResult<()> {
    blocking!(state, |dir| gitsync::pull(&dir))
}

#[tauri::command]
pub async fn git_push(state: State<'_, AppState>) -> AppResult<()> {
    blocking!(state, |dir| gitsync::push(&dir))
}

#[tauri::command]
pub async fn git_branches(state: State<'_, AppState>) -> AppResult<Vec<Branch>> {
    blocking!(state, |dir| gitsync::branches(&dir))
}

#[tauri::command]
pub async fn git_checkout(state: State<'_, AppState>, name: String) -> AppResult<()> {
    blocking!(state, |dir| gitsync::checkout(&dir, &name))
}

#[tauri::command]
pub async fn git_create_branch(state: State<'_, AppState>, name: String) -> AppResult<()> {
    blocking!(state, |dir| gitsync::create_branch(&dir, &name))
}

#[tauri::command]
pub async fn git_history(state: State<'_, AppState>, limit: u32) -> AppResult<Vec<Commit>> {
    blocking!(state, |dir| gitsync::history(&dir, limit))
}

#[tauri::command]
pub async fn git_commit_files(state: State<'_, AppState>, hash: String) -> AppResult<Vec<FileEntry>> {
    blocking!(state, |dir| gitsync::commit_files(&dir, &hash))
}

#[tauri::command]
pub async fn git_commit_diff(
    state: State<'_, AppState>,
    hash: String,
    path: String,
) -> AppResult<String> {
    blocking!(state, |dir| gitsync::diff_commit_file(&dir, &hash, &path))
}

#[tauri::command]
pub async fn git_file_diff(
    state: State<'_, AppState>,
    path: String,
    staged: bool,
) -> AppResult<String> {
    blocking!(state, |dir| gitsync::diff_worktree_file(&dir, &path, staged))
}

#[tauri::command]
pub async fn git_init(state: State<'_, AppState>) -> AppResult<()> {
    blocking!(state, |dir| gitsync::init(&dir))
}

#[tauri::command]
pub async fn git_set_remote(state: State<'_, AppState>, url: String) -> AppResult<()> {
    blocking!(state, |dir| gitsync::set_remote(&dir, &url))
}

/// Whether the GitHub CLI can create a repo for us — checked before the panel
/// offers to, so the button is absent rather than failing when clicked.
#[tauri::command]
pub async fn github_status(state: State<'_, AppState>) -> AppResult<GithubStatus> {
    blocking!(state, |dir| gitsync::github_status(&dir))
}

/// Create the repo on GitHub, wire up `origin`, and push.
#[tauri::command]
pub async fn github_publish(state: State<'_, AppState>, name: String) -> AppResult<()> {
    blocking!(state, |dir| gitsync::github_publish(&dir, &name))
}
