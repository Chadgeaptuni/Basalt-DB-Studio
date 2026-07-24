import { invoke } from "./client";
import type { AppSettings } from "./types";

// App-settings commands — the ONLY invoke site for this domain. Persisted to
// settings.toml in the config dir. Mirrors src-tauri/src/config/settings.rs.
export const settingsApi = {
  get: () => invoke<AppSettings>("get_settings"),
  save: (settings: AppSettings) => invoke<void>("save_settings", { settings }),
};
