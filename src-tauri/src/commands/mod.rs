//! Thin `#[tauri::command]` handlers, one file per domain (added M1+). Commands
//! deserialize, call a service, and map the error — no business logic here.

pub mod connections;
pub mod introspect;
pub mod query;

/// Liveness smoke-test command. Real domains land in M1+.
#[tauri::command]
pub fn ping() -> &'static str {
    "pong"
}
