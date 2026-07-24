//! TOML config: connection profiles (the git-sync unit) and app settings. Pure
//! filesystem + serde; nothing here imports `tauri`.

pub mod connections;
pub mod paths;
pub mod saved_queries;
pub mod settings;

pub use paths::Paths;
