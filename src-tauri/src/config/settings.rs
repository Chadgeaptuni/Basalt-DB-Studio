//! App settings TOML (`settings.toml`). Minimal in this slice — a round-tripping
//! value type only; no command reads or writes it yet. `datetime_display`
//! controls how cells *render*, never the stored/edited value.

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum DatetimeDisplay {
    /// Show the value exactly as the engine returned it.
    Stored,
    Local,
    Utc,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub default_row_limit: u32,
    pub datetime_display: DatetimeDisplay,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            default_row_limit: 500,
            datetime_display: DatetimeDisplay::Stored,
        }
    }
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
    fn datetime_display_serializes_lowercase() {
        let settings = AppSettings {
            default_row_limit: 1000,
            datetime_display: DatetimeDisplay::Utc,
        };
        let text = toml::to_string(&settings).unwrap();
        assert!(text.contains("datetimeDisplay = \"utc\""), "got:\n{text}");
    }
}
