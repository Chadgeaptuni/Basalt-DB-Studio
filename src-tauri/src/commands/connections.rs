//! Thin connection command handlers: deserialize, call the service, map the
//! error. No logic here. Tauri maps the JS camelCase args to these snake_case
//! params (`profileId` → `profile_id`, `sessionId` → `session_id`).

use tauri::State;

use crate::config::connections::{self, ConnectionProfile};
use crate::drivers::types::SessionInfo;
use crate::secrets::{self, Secret};
use crate::services::connection_service;
use crate::state::AppState;
use crate::AppResult;

#[tauri::command]
pub fn list_connections(state: State<AppState>) -> AppResult<Vec<ConnectionProfile>> {
    connections::load_all(&state.paths)
}

/// Saves the profile after bringing its keychain entry in line: `remember` off
/// forgets any saved secret, on stores the non-empty fields of `secret`.
#[tauri::command]
pub fn save_connection(
    mut profile: ConnectionProfile,
    secret: Secret,
    remember: bool,
    state: State<AppState>,
) -> AppResult<()> {
    secrets::apply(&mut profile, secret, remember)?;
    connections::save(&state.paths, &profile)
}

#[tauri::command]
pub fn delete_connection(id: String, state: State<AppState>) -> AppResult<()> {
    secrets::forget(&connections::load_one(&state.paths, &id)?)?;
    connections::delete(&state.paths, &id)
}

/// `password` given (the form's field, a prompt) wins; otherwise the saved one.
#[tauri::command]
pub async fn test_connection(
    profile: ConnectionProfile,
    password: Option<String>,
) -> AppResult<()> {
    let password = password_for(&profile, password)?;
    connection_service::test_connection(&profile, password.as_deref()).await
}

#[tauri::command]
pub async fn connect(
    profile_id: String,
    password: Option<String>,
    database: Option<String>,
    state: State<'_, AppState>,
) -> AppResult<SessionInfo> {
    let profile = connections::load_one(&state.paths, &profile_id)?;
    let password = password_for(&profile, password)?;
    connection_service::connect(
        &profile,
        password.as_deref(),
        database.as_deref(),
        &state.sessions,
    )
    .await
}

#[tauri::command]
pub async fn disconnect(session_id: String, state: State<'_, AppState>) -> AppResult<()> {
    connection_service::disconnect(&session_id, &state.sessions).await
}

fn password_for(profile: &ConnectionProfile, given: Option<String>) -> AppResult<Option<String>> {
    match given {
        Some(password) => Ok(Some(password)),
        None => Ok(secrets::load(profile)?.and_then(|s| s.password)),
    }
}
