// The window-management boundary (DESIGN §9). The app draws its own title bar,
// so the minimize / maximize / close buttons have to reach the OS window — and
// that call belongs here with the rest of the Tauri surface, not in a component.
//
// These are core Tauri commands rather than ones we wrote, so they go through
// `getCurrentWindow()` instead of `client.ts`'s `invoke`. They also can't fail
// in a way the user could act on — a rejected `minimize()` means the capability
// is missing, which is a build error, not a runtime state — so this module has
// no `ApiError` surface.

import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

/** False under vitest and in a plain browser, where there is no window to drive. */
const available = isTauri();

const current = () => getCurrentWindow();

export const windowApi = {
  /** Callers render nothing when this is false rather than throwing on click. */
  get available(): boolean {
    return available;
  },

  minimize(): void {
    if (available) void current().minimize();
  },

  toggleMaximize(): void {
    if (available) void current().toggleMaximize();
  },

  close(): void {
    if (available) void current().close();
  },

  async isMaximized(): Promise<boolean> {
    return available ? current().isMaximized() : false;
  },

  /**
   * Subscribe to maximize/restore. There is no dedicated event, so this rides
   * `onResized` — maximizing always resizes, and a plain resize re-reporting the
   * same value is harmless. Returns an unsubscribe.
   */
  onMaximizeChange(run: (maximized: boolean) => void): () => void {
    if (!available) return () => {};
    const w = current();
    let stop: (() => void) | undefined;
    let cancelled = false;

    void w.isMaximized().then(run);
    void w
      .onResized(() => void w.isMaximized().then(run))
      .then((un) => {
        // The window may have unmounted while the listener was registering.
        if (cancelled) un();
        else stop = un;
      });

    return () => {
      cancelled = true;
      stop?.();
    };
  },
};
