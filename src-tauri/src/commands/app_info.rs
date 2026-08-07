//! Build and runtime facts about this install, for the About tab.
//!
//! No service behind it: every field is a compile-time constant, something Tauri
//! already holds, or one `os_info` probe — so there is nothing to put in one. One
//! command rather than four `@tauri-apps/api/app` calls plus the os plugin's JS
//! side, each of which would need its own permission in `capabilities/`.
//!
//! The OS reads as two fields on purpose. `tauri-plugin-os` reports Windows 11 as
//! `10.0.26200`, which is the true build number and also the reason a user would
//! swear the app got it wrong; `os_info::edition()` is what turns it into
//! "Windows 11". Neither alone is the answer, so both are here — name for the
//! reader, build number for whoever has to reproduce it.
//!
//! Never the hostname, which `tauri-plugin-os` will also give: this block is
//! built to be pasted into public issues, and hostnames routinely carry a
//! person's name.

use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_os::Version;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub identifier: String,
    pub tauri_version: &'static str,
    /// The webview actually rendering this window — WebView2 on Windows, WebKit
    /// elsewhere. `None` when the runtime declines to report it, which is a real
    /// state and not an error: nothing else on the page depends on knowing.
    pub webview_version: Option<String>,
    /// The OS as a person names it: "Windows 11", "Mac OS", "Ubuntu".
    pub os_name: String,
    /// The build number underneath that name, or `None` when the platform will
    /// not say — which is a real answer on some Linux distributions.
    pub os_version: Option<String>,
    /// Target triple parts. What this binary was *built* for, which is a
    /// different question from what it is running on: an x86_64 build under
    /// emulation on an ARM machine reports `x86_64` here, correctly.
    pub os: &'static str,
    pub arch: &'static str,
    pub family: &'static str,
    /// True for `tauri dev` builds. Worth stating: a debug build's timings and
    /// bundle size are nothing like the release the user would otherwise assume.
    pub debug: bool,
}

/// Falls back to the OS *type* where there is no edition — os_info reports one
/// on Windows and macOS, and on Linux the type already is the distribution.
fn os_name() -> String {
    let info = os_info::get();
    info.edition()
        .map(str::to_owned)
        .unwrap_or_else(|| info.os_type().to_string())
}

#[tauri::command]
pub fn app_info(app: AppHandle) -> AppInfo {
    let package = app.package_info();
    AppInfo {
        name: package.name.clone(),
        version: package.version.to_string(),
        identifier: app.config().identifier.clone(),
        tauri_version: tauri::VERSION,
        webview_version: tauri::webview_version().ok(),
        os_name: os_name(),
        // `Unknown` is not a version string to show the user; it is the absence
        // of one, and the frontend already has a rendering for that.
        os_version: match tauri_plugin_os::version() {
            Version::Unknown => None,
            known => Some(known.to_string()),
        },
        os: std::env::consts::OS,
        arch: std::env::consts::ARCH,
        family: std::env::consts::FAMILY,
        debug: cfg!(debug_assertions),
    }
}
