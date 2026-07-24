//! `AppState` is the single Tauri-managed value: the live session registry plus
//! the resolved config paths. Async commands reach it via
//! `tauri::State<'_, AppState>`; the registry uses `tokio::sync::Mutex` so it may
//! be held across `.await`.

use std::collections::HashMap;

use tokio::sync::Mutex;

use crate::config::Paths;
use crate::services::connection_service::SessionRegistry;
use crate::AppResult;

pub struct AppState {
    pub sessions: SessionRegistry,
    pub paths: Paths,
}

impl AppState {
    pub fn new() -> AppResult<Self> {
        Ok(Self {
            sessions: Mutex::new(HashMap::new()),
            paths: Paths::resolve()?,
        })
    }
}
