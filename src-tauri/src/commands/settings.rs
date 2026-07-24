//! App-settings commands: thin wrappers over `config::settings`. Fast filesystem
//! ops, so they stay synchronous.

use tauri::State;

use crate::config::settings::{self, AppSettings};
use crate::state::AppState;
use crate::AppResult;

#[tauri::command]
pub fn get_settings(state: State<AppState>) -> AppResult<AppSettings> {
    settings::load(&state.paths)
}

#[tauri::command]
pub fn save_settings(settings: AppSettings, state: State<AppState>) -> AppResult<()> {
    settings::save(&state.paths, &settings)
}
