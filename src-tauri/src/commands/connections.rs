//! Thin connection command handlers: deserialize, call the service, map the
//! error. No logic here. Tauri maps the JS camelCase args to these snake_case
//! params (`profileId` → `profile_id`, `sessionId` → `session_id`).

use tauri::State;

use crate::config::connections::{self, ConnectionProfile};
use crate::drivers::types::SessionInfo;
use crate::services::connection_service;
use crate::state::AppState;
use crate::AppResult;

#[tauri::command]
pub fn list_connections(state: State<AppState>) -> AppResult<Vec<ConnectionProfile>> {
    connections::load_all(&state.paths)
}

#[tauri::command]
pub fn save_connection(profile: ConnectionProfile, state: State<AppState>) -> AppResult<()> {
    connections::save(&state.paths, &profile)
}

#[tauri::command]
pub fn delete_connection(id: String, state: State<AppState>) -> AppResult<()> {
    connections::delete(&state.paths, &id)
}

#[tauri::command]
pub async fn test_connection(
    profile: ConnectionProfile,
    password: Option<String>,
) -> AppResult<()> {
    connection_service::test_connection(&profile, password.as_deref()).await
}

#[tauri::command]
pub async fn connect(
    profile_id: String,
    password: Option<String>,
    state: State<'_, AppState>,
) -> AppResult<SessionInfo> {
    let profile = connections::load_one(&state.paths, &profile_id)?;
    connection_service::connect(&profile, password.as_deref(), &state.sessions).await
}

#[tauri::command]
pub async fn disconnect(session_id: String, state: State<'_, AppState>) -> AppResult<()> {
    connection_service::disconnect(&session_id, &state.sessions).await
}
