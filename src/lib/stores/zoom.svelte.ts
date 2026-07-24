// App zoom (VSCode-style Cmd/Ctrl + = / - / 0). CSS `zoom` on #app re-rasterizes
// crisply — unlike transform:scale it scales the whole UI including px-based layout
// and never blurs text. Persisted per-machine (localStorage, like the theme store).

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
  // `zoom` isn't in the typed CSSOM surface — set it via the property API.
  document.getElementById("app")?.style.setProperty("zoom", String(level));
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
  /** Write persisted zoom to #app before first paint (main.ts). */
  apply,
  in: () => set(level + STEP),
  out: () => set(level - STEP),
  reset: () => set(DEFAULT),
};
