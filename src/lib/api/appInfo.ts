import { invoke } from "./client";
import type { AppInfo } from "./types";

// Build and runtime facts — the ONLY invoke site for this domain. One call
// rather than four `@tauri-apps/api/app` reads, each of which would need its own
// core permission in `capabilities/`. Mirrors src-tauri/src/commands/app_info.rs.
export const appInfoApi = {
  get: () => invoke<AppInfo>("app_info"),
};
