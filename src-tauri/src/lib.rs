mod commands;
mod errors;
mod logging;

// Domain modules are `pub` so the (env-gated) integration-test crate under
// `tests/` can drive them, and so genuinely-public-but-not-yet-wired API (e.g.
// `config::settings`) is part of the crate surface rather than dead code.
pub mod config;
pub mod drivers;
pub mod services;
pub mod sqlgen;
pub mod state;

pub use errors::{AppError, AppResult};

use state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // File logging comes up first so startup is captured. The guard lives
            // in app state so the async writer flushes on shutdown.
            match logging::init(app.handle()) {
                Ok(guard) => {
                    app.manage(guard);
                }
                Err(e) => eprintln!("basalt: file logging unavailable: {e}"),
            }
            app.manage(AppState::new()?);
            tracing::info!("Basalt DB Studio starting");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::ping,
            commands::connections::list_connections,
            commands::connections::save_connection,
            commands::connections::delete_connection,
            commands::connections::test_connection,
            commands::connections::connect,
            commands::connections::disconnect,
            commands::introspect::introspect,
            commands::introspect::describe_table,
            commands::query::run_query,
            commands::grid::grid_browse,
            commands::grid::grid_commit,
            commands::ddl::ddl_generate,
            commands::export::export_query,
            commands::export::export_table,
            commands::import::import_csv,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
