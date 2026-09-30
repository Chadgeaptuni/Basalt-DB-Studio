//! Thin connection command handlers: deserialize, call the service, map the
//! error. No logic here. Tauri maps the JS camelCase args to these snake_case
//! params (`profileId` → `profile_id`, `sessionId` → `session_id`).

use tauri::State;

use crate::config::connections::{self, ConnectionProfile};
use crate::drivers::types::{SessionInfo, SshAuthKind};
use crate::secrets::{self, Secret};
use crate::services::connection_service;
use crate::ssh_hosts::{self, SshHost};
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

/// A secret given (the form's fields, a prompt) wins; otherwise the saved one.
#[tauri::command]
pub async fn test_connection(
    profile: ConnectionProfile,
    password: Option<String>,
    ssh_secret: Option<String>,
) -> AppResult<()> {
    let secret = secret_for(&profile, password, ssh_secret)?;
    connection_service::test_connection(&profile, secret.password.as_deref(), secret.ssh.as_deref())
        .await
}

#[tauri::command]
pub async fn connect(
    profile_id: String,
    password: Option<String>,
    ssh_secret: Option<String>,
    database: Option<String>,
    state: State<'_, AppState>,
) -> AppResult<SessionInfo> {
    let profile = connections::load_one(&state.paths, &profile_id)?;
    let secret = secret_for(&profile, password, ssh_secret)?;
    connection_service::connect(
        &profile,
        secret.password.as_deref(),
        secret.ssh.as_deref(),
        database.as_deref(),
        &state.sessions,
    )
    .await
}

#[tauri::command]
pub async fn disconnect(session_id: String, state: State<'_, AppState>) -> AppResult<()> {
    connection_service::disconnect(&session_id, &state.sessions).await
}

/// `async` only to leave the main thread: it waits on one `ssh -G` per host.
#[tauri::command(async)]
pub fn list_ssh_hosts() -> Vec<SshHost> {
    ssh_hosts::list()
}

/// The keychain is read only for what the caller did not supply.
fn secret_for(
    profile: &ConnectionProfile,
    password: Option<String>,
    ssh: Option<String>,
) -> AppResult<Secret> {
    let needs_ssh = profile
        .ssh
        .as_ref()
        .is_some_and(|s| s.auth_kind != SshAuthKind::Agent);
    if password.is_some() && (ssh.is_some() || !needs_ssh) {
        return Ok(Secret { password, ssh });
    }
    let saved = secrets::load(profile)?.unwrap_or_default();
    Ok(Secret {
        password: password.or(saved.password),
        ssh: ssh.or(saved.ssh),
    })
}
