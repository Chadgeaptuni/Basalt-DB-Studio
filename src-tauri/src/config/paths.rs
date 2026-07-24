//! On-disk locations under the OS config dir (`dirs::config_dir()/basalt`). This
//! directory *is* the git-sync repo, so it holds only diff-able TOML — never
//! secrets. Nothing is created here eagerly: the `config` writers `create_dir_all`
//! on demand, keeping app startup free of filesystem side effects.

use std::path::PathBuf;

use crate::{AppError, AppResult};

#[derive(Clone, Debug)]
pub struct Paths {
    pub config_dir: PathBuf,
    pub connections_dir: PathBuf,
    pub settings_file: PathBuf,
}

impl Paths {
    pub fn resolve() -> AppResult<Self> {
        let base = dirs::config_dir().ok_or_else(|| {
            AppError::ConfigIo("could not determine the OS config directory".into())
        })?;
        let config_dir = base.join("basalt");
        Ok(Self {
            connections_dir: config_dir.join("connections"),
            settings_file: config_dir.join("settings.toml"),
            config_dir,
        })
    }
}
