//! On-disk locations under the app config dir — Tauri's `app_config_dir()`,
//! `<OS config dir>/<bundle identifier>`, beside the app's logs and webview data
//! and the folder the Windows uninstaller offers to clear. It holds only TOML and
//! saved `.sql` — never secrets. Nothing is created here eagerly: the `config`
//! writers `create_dir_all` on demand, keeping app startup free of filesystem
//! side effects.

use std::fs;
use std::path::PathBuf;

use crate::{AppError, AppResult};

#[derive(Clone, Debug)]
pub struct Paths {
    pub config_dir: PathBuf,
    pub connections_file: PathBuf,
    /// Saved queries (`.sql` files under nestable folders).
    pub queries_dir: PathBuf,
    pub settings_file: PathBuf,
}

impl Paths {
    /// All paths under one config dir. The app passes Tauri's; tests pass a temp.
    pub fn under(config_dir: PathBuf) -> Self {
        Self {
            connections_file: config_dir.join("connections.toml"),
            queries_dir: config_dir.join("queries"),
            settings_file: config_dir.join("settings.toml"),
            config_dir,
        }
    }

    /// Moves a pre-0.2 config dir (`<OS config dir>/basalt`) to this one, when
    /// this one does not exist yet. A rename within one parent, so it is atomic.
    // ponytail: one-time migration; delete once no pre-0.2 install remains.
    pub fn adopt_legacy_dir(&self) -> AppResult<()> {
        let Some(legacy) = self.config_dir.parent().map(|p| p.join("basalt")) else {
            return Ok(());
        };
        if self.config_dir.exists() || !legacy.is_dir() {
            return Ok(());
        }
        fs::rename(&legacy, &self.config_dir).map_err(|e| AppError::ConfigIo(e.to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_legacy_dir_moves_only_when_the_new_one_is_absent() {
        let root = std::env::temp_dir().join(format!("basalt-root-{}", uuid::Uuid::new_v4()));
        let legacy = root.join("basalt");
        fs::create_dir_all(&legacy).unwrap();
        fs::write(legacy.join("settings.toml"), "defaultRowLimit = 100\n").unwrap();

        let paths = Paths::under(root.join("app.basalt.studio"));
        paths.adopt_legacy_dir().unwrap();
        assert!(!legacy.exists());
        assert!(paths.settings_file.exists());

        // A second legacy dir appearing later is left alone, never merged over.
        fs::create_dir_all(&legacy).unwrap();
        paths.adopt_legacy_dir().unwrap();
        assert!(legacy.exists());

        fs::remove_dir_all(&root).ok();
    }
}
