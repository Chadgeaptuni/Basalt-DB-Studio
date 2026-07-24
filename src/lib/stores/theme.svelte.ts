// Theme = which `[data-theme]` block is active on <html>. Presets only swap CSS
// variables (DESIGN §3), so switching is a single attribute write.

export const THEMES = ["basalt-dark", "basalt-light", "basalt-nord", "basalt-paper"] as const;
export type ThemeName = (typeof THEMES)[number];

/** Which presets are dark — drives the StatusBar quick sun/moon toggle target. */
export const DARK_THEMES: readonly ThemeName[] = ["basalt-dark", "basalt-nord"];

const STORAGE_KEY = "basalt.theme";
const DEFAULT: ThemeName = "basalt-dark";

function load(): ThemeName {
  const saved = localStorage.getItem(STORAGE_KEY);
  return (THEMES as readonly string[]).includes(saved ?? "") ? (saved as ThemeName) : DEFAULT;
}

let current = $state<ThemeName>(load());

export const theme = {
  get current() {
    return current;
  },
  get available() {
    return THEMES;
  },
  /** Write the current theme to <html>. Called once before mount (main.ts). */
  apply() {
    document.documentElement.setAttribute("data-theme", current);
  },
  set(name: ThemeName) {
    current = name;
    localStorage.setItem(STORAGE_KEY, name);
    document.documentElement.setAttribute("data-theme", name);
  },
};
