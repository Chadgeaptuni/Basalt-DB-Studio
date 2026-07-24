//! Saved-query commands: thin wrappers over `config::saved_queries`. Fast
//! filesystem ops (no network), so they stay synchronous.

use tauri::State;

use crate::config::saved_queries::{self, SavedQuery};
use crate::state::AppState;
use crate::AppResult;

#[tauri::command]
pub fn list_saved_queries(state: State<AppState>) -> AppResult<Vec<SavedQuery>> {
    saved_queries::list(&state.paths)
}

#[tauri::command]
pub fn read_saved_query(path: String, state: State<AppState>) -> AppResult<String> {
    saved_queries::read(&state.paths, &path)
}

#[tauri::command]
pub fn save_query(path: String, sql: String, state: State<AppState>) -> AppResult<()> {
    saved_queries::save(&state.paths, &path, &sql)
}

#[tauri::command]
pub fn delete_saved_query(path: String, state: State<AppState>) -> AppResult<()> {
    saved_queries::delete(&state.paths, &path)
}
