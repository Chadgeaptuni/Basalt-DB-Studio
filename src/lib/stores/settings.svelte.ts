import { settingsApi } from "$lib/api/settings";
import type { AppSettings, DatetimeDisplay } from "$lib/api/types";
import { toast } from "./toasts.svelte";
import type { ApiError } from "$lib/api/client";

// App settings (persisted to settings.toml). `datetimeDisplay` drives cell
// rendering; `defaultRowLimit` is the fetch cap the editor passes per run. Loaded
// once at startup; every setter persists immediately (optimistic — DESIGN §8).

const DEFAULTS: AppSettings = { defaultRowLimit: 500, datetimeDisplay: "stored" };

let current = $state<AppSettings>({ ...DEFAULTS });

async function persist(): Promise<void> {
  try {
    await settingsApi.save($state.snapshot(current));
  } catch (e) {
    toast.error(`Could not save settings: ${(e as ApiError).message}`);
  }
}

export const settings = {
  get current() {
    return current;
  },
  get datetimeDisplay() {
    return current.datetimeDisplay;
  },
  get defaultRowLimit() {
    return current.defaultRowLimit;
  },
  /** Load persisted settings at startup; stays on defaults if the read fails. */
  async load(): Promise<void> {
    try {
      current = await settingsApi.get();
    } catch {
      current = { ...DEFAULTS };
    }
  },
  setDatetimeDisplay(mode: DatetimeDisplay): void {
    current.datetimeDisplay = mode;
    void persist();
  },
  setDefaultRowLimit(limit: number): void {
    current.defaultRowLimit = limit;
    void persist();
  },
};
