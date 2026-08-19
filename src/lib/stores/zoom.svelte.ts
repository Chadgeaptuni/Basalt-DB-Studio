// App zoom (VSCode-style Cmd/Ctrl + = / - / 0). CSS `zoom` re-rasterizes crisply —
// unlike transform:scale it scales the whole UI including px-based layout and never
// blurs text. Persisted per-machine (localStorage, like the theme store).
//
// The level is published as one custom property on <html> rather than written onto
// #app directly, because #app is not the only root that has to scale: every
// portalled overlay (dialogs, menus, tooltips, the select listbox) is mounted on
// <body> as a *sibling* of #app, so a zoom set on #app leaves all of them at 100%.
// app.css applies `var(--ui-zoom)` to #app; the overlays apply it through the
// `app-zoom` utility.

const STORAGE_KEY = "basalt.zoom";
const MIN = 0.5;
const MAX = 2;
const STEP = 0.1;
const DEFAULT = 1;

const clamp = (z: number): number => Math.min(MAX, Math.max(MIN, Math.round(z * 10) / 10));

function load(): number {
  const n = Number(localStorage.getItem(STORAGE_KEY));
  return n >= MIN && n <= MAX ? n : DEFAULT;
}

let level = $state(load());

function apply(): void {
  document.documentElement.style.setProperty("--ui-zoom", String(level));
}

function set(z: number): void {
  level = clamp(z);
  localStorage.setItem(STORAGE_KEY, String(level));
  apply();
}

export const zoom = {
  get level() {
    return level;
  },
  /**
   * Whether a step would change anything. The status bar's stepper disables its
   * buttons on these rather than letting a click at the end of the range look
   * broken — `clamp` would silently return the same level.
   */
  get canIn() {
    return level < MAX;
  },
  get canOut() {
    return level > MIN;
  },
  /** Publish the persisted level before first paint (main.ts). */
  apply,
  in: () => set(level + STEP),
  out: () => set(level - STEP),
  reset: () => set(DEFAULT),
};
