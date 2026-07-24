//! Thin introspection command handlers. The session's driver lives in the
//! registry; the service performs the lookup and dispatch.

use tauri::State;

use crate::drivers::types::{SchemaTree, TableDescription};
use crate::services::connection_service;
use crate::state::AppState;
use crate::AppResult;

#[tauri::command]
pub async fn introspect(session_id: String, state: State<'_, AppState>) -> AppResult<SchemaTree> {
    connection_service::introspect(&session_id, &state.sessions).await
}

#[tauri::command]
pub async fn describe_table(
    session_id: String,
    namespace: String,
    table: String,
    state: State<'_, AppState>,
) -> AppResult<TableDescription> {
    connection_service::describe_table(&session_id, &namespace, &table, &state.sessions).await
}
