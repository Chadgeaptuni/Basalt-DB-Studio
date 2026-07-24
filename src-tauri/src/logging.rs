use tauri::{AppHandle, Manager, Runtime};
use tracing_appender::non_blocking::WorkerGuard;
use tracing_subscriber::{fmt, EnvFilter};

/// Initialize tracing to a daily-rotating file in the OS log dir
/// (`app_log_dir`: `~/Library/Logs/…` on macOS, `%LOCALAPPDATA%\…\logs` on
/// Windows, `~/.local/state/…` on Linux). Given the no-telemetry stance, this
/// file is the primary diagnostic (spec §Distribution).
///
/// The returned [`WorkerGuard`] must be kept alive for the async writer to
/// flush; callers store it in app state.
pub fn init<R: Runtime>(app: &AppHandle<R>) -> Result<WorkerGuard, Box<dyn std::error::Error>> {
    let dir = app.path().app_log_dir()?;
    std::fs::create_dir_all(&dir)?;

    let appender = tracing_appender::rolling::daily(&dir, "basalt.log");
    let (writer, guard) = tracing_appender::non_blocking(appender);

    // Override with e.g. BASALT_LOG=debug,sqlx=warn.
    let filter = EnvFilter::try_from_env("BASALT_LOG").unwrap_or_else(|_| EnvFilter::new("info"));

    fmt()
        .with_env_filter(filter)
        .with_writer(writer)
        .with_ansi(false)
        .init();

    Ok(guard)
}
