mod commands;
mod errors;
mod logging;

// Domain modules are `pub` so the (env-gated) integration-test crate under
// `tests/` can drive them, and so genuinely-public-but-not-yet-wired API (e.g.
// `config::settings`) is part of the crate surface rather than dead code.
pub mod config;
pub mod drivers;
pub mod gitsync;
pub mod services;
pub mod sqlgen;
pub mod state;

pub use errors::{AppError, AppResult};

use state::AppState;
use tauri::Manager;

/// The frontend draws the title bar (`layout/TopBar.svelte`), so the native one
/// has to go on Windows and Linux.
///
/// This is done here rather than through `decorations: false` in the config
/// because Tauri merges `tauri.<platform>.conf.json` with RFC 7386 semantics,
/// under which an array patch *replaces* the array it patches — a platform file
/// carrying only `decorations` would silently drop the window's size and title
/// with it. macOS is untouched on purpose: it keeps its native traffic lights,
/// floated over our bar by `titleBarStyle: "Overlay"`.
fn drop_native_titlebar(app: &tauri::AppHandle) {
    #[cfg(not(target_os = "macos"))]
    if let Some(window) = app.get_webview_window("main") {
        if let Err(e) = window.set_decorations(false) {
            // Not fatal: the app is fully usable with both title bars, which is
            // a far better failure than no window at all.
            tracing::warn!("could not remove the native title bar: {e}");
        }
    }
    #[cfg(target_os = "macos")]
    let _ = app;
}

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
            drop_native_titlebar(app.handle());
            tracing::info!("Basalt DB Studio starting");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::ping,
            commands::app_info::app_info,
            commands::connections::list_connections,
            commands::connections::save_connection,
            commands::connections::delete_connection,
            commands::connections::test_connection,
            commands::connections::connect,
            commands::connections::disconnect,
            commands::introspect::introspect,
            commands::introspect::list_databases,
            commands::introspect::describe_table,
            commands::query::run_query,
            commands::grid::grid_browse,
            commands::grid::grid_commit,
            commands::ddl::ddl_generate,
            commands::export::export_query,
            commands::export::export_table,
            commands::import::import_csv,
            commands::gitsync::git_status,
            commands::gitsync::git_sync,
            commands::gitsync::git_stage,
            commands::gitsync::git_unstage,
            commands::gitsync::git_discard,
            commands::gitsync::git_commit,
            commands::gitsync::git_fetch,
            commands::gitsync::git_pull,
            commands::gitsync::git_push,
            commands::gitsync::git_branches,
            commands::gitsync::git_checkout,
            commands::gitsync::git_create_branch,
            commands::gitsync::git_history,
            commands::gitsync::git_commit_files,
            commands::gitsync::git_commit_diff,
            commands::gitsync::git_file_diff,
            commands::gitsync::git_init,
            commands::gitsync::git_set_remote,
            commands::gitsync::github_status,
            commands::gitsync::github_publish,
            commands::saved_queries::list_saved_queries,
            commands::saved_queries::read_saved_query,
            commands::saved_queries::save_query,
            commands::saved_queries::delete_saved_query,
            commands::settings::get_settings,
            commands::settings::save_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
