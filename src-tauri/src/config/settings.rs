//! App settings TOML (`settings.toml`). `datetime_display` controls how cells
//! *render*, never the stored/edited value; `default_row_limit` is the fetch cap
//! and `statement_timeout_secs` (0 = off) the cancel deadline the editor passes
//! per run. Lives in the config dir.

use std::fs;

use serde::{Deserialize, Serialize};

use crate::config::Paths;
use crate::{AppError, AppResult};

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum DatetimeDisplay {
    /// Show the value exactly as the engine returned it.
    Stored,
    Local,
    Utc,
}

/// `default` so a settings file written before a field existed still loads.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct AppSettings {
    pub default_row_limit: u32,
    pub datetime_display: DatetimeDisplay,
    pub statement_timeout_secs: u32,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            default_row_limit: 500,
            datetime_display: DatetimeDisplay::Stored,
            statement_timeout_secs: 0,
        }
    }
}

/// Load `settings.toml`, falling back to defaults when it's absent (first run).
pub fn load(paths: &Paths) -> AppResult<AppSettings> {
    if !paths.settings_file.exists() {
        return Ok(AppSettings::default());
    }
    let text =
        fs::read_to_string(&paths.settings_file).map_err(|e| AppError::ConfigIo(e.to_string()))?;
    toml::from_str(&text).map_err(|e| AppError::ConfigParse(format!("settings.toml: {e}")))
}

pub fn save(paths: &Paths, settings: &AppSettings) -> AppResult<()> {
    fs::create_dir_all(&paths.config_dir).map_err(|e| AppError::ConfigIo(e.to_string()))?;
    let text = toml::to_string_pretty(settings).map_err(AppError::internal)?;
    fs::write(&paths.settings_file, text).map_err(|e| AppError::ConfigIo(e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_round_trip_through_toml() {
        let settings = AppSettings::default();
        let text = toml::to_string_pretty(&settings).unwrap();
        let parsed: AppSettings = toml::from_str(&text).unwrap();
        assert_eq!(parsed, settings);
        assert_eq!(parsed.default_row_limit, 500);
    }

    #[test]
    fn load_missing_is_default_then_save_round_trips() {
        let paths =
            Paths::under(std::env::temp_dir().join(format!("basalt-set-{}", uuid::Uuid::new_v4())));
        assert_eq!(load(&paths).unwrap(), AppSettings::default());

        let custom = AppSettings {
            default_row_limit: 2000,
            datetime_display: DatetimeDisplay::Local,
            statement_timeout_secs: 30,
        };
        save(&paths, &custom).unwrap();
        assert_eq!(load(&paths).unwrap(), custom);

        fs::remove_dir_all(&paths.config_dir).ok();
    }

    #[test]
    fn datetime_display_serializes_lowercase() {
        let settings = AppSettings {
            datetime_display: DatetimeDisplay::Utc,
            ..AppSettings::default()
        };
        let text = toml::to_string(&settings).unwrap();
        assert!(text.contains("datetimeDisplay = \"utc\""), "got:\n{text}");
    }

    #[test]
    fn a_file_from_before_the_timeout_setting_still_loads() {
        let parsed: AppSettings =
            toml::from_str("defaultRowLimit = 100\ndatetimeDisplay = \"local\"\n").unwrap();
        assert_eq!(parsed.default_row_limit, 100);
        assert_eq!(parsed.statement_timeout_secs, 0);
    }
}
