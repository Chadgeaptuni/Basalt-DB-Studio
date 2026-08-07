//! Thin `#[tauri::command]` handlers, one file per domain (added M1+). Commands
//! deserialize, call a service, and map the error — no business logic here.

pub mod app_info;
pub mod connections;
pub mod ddl;
pub mod export;
pub mod gitsync;
pub mod grid;
pub mod import;
pub mod introspect;
pub mod query;
pub mod saved_queries;
pub mod settings;

/// Liveness smoke-test command. Real domains land in M1+.
#[tauri::command]
pub fn ping() -> &'static str {
    "pong"
}
