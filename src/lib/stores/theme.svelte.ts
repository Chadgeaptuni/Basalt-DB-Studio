import {
  THEME_SEEDS,
  THEME_VARIANTS,
  themeTokens,
  customSeed,
  type ThemeVariant,
  type ThemeSeed,
  type CustomColors,
} from "./themeData";

export { THEME_VARIANTS, type ThemeVariant } from "./themeData";

export interface CustomTheme {
  id: string;
  name: string;
  colors: CustomColors;
}

const STORAGE_KEY_THEME = "basalt.theme";
const STORAGE_KEY_VARIANT = "basalt.theme_variant";
const STORAGE_KEY_CUSTOM = "basalt.custom_themes";
const DEFAULT_THEME = "basalt-dark";

const seedById = new Map(THEME_SEEDS.map((s) => [s.id, s]));

function loadTheme(): string {
  return localStorage.getItem(STORAGE_KEY_THEME) || DEFAULT_THEME;
}

function loadVariant(): ThemeVariant {
  const saved = localStorage.getItem(STORAGE_KEY_VARIANT) as ThemeVariant;
  return THEME_VARIANTS.includes(saved) ? saved : "dark";
}

function loadCustomThemes(): CustomTheme[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM);
    return raw ? (JSON.parse(raw) as CustomTheme[]) : [];
  } catch {
    return [];
  }
}

let currentTheme = $state<string>(loadTheme());
let currentVariant = $state<ThemeVariant>(loadVariant());
let customThemesList = $state<CustomTheme[]>(loadCustomThemes());

function resolveSeed(themeId: string, customList: CustomTheme[]): { seed: ThemeSeed; custom: boolean } {
  const custom = customList.find((t) => t.id === themeId);
  if (custom) return { seed: customSeed(custom.id, custom.name, custom.colors), custom: true };
  return { seed: seedById.get(themeId) ?? seedById.get(DEFAULT_THEME)!, custom: false };
}

function applyThemeToDOM(themeId: string, variant: ThemeVariant, customList: CustomTheme[]): void {
  const root = document.documentElement;
  const { seed, custom } = resolveSeed(themeId, customList);
  // Custom themes have no light/dark inversion; render them as authored (OLED
  // still blackens surfaces). Presets get their real per-variant palette.
  const effective: ThemeVariant = custom && variant === "light" ? "dark" : variant;
  const tokens = themeTokens(seed, effective);

  for (const [name, value] of Object.entries(tokens)) root.style.setProperty(name, value);
  root.setAttribute("data-theme", themeId);
  root.setAttribute("data-variant", variant);
  root.style.colorScheme = variant === "light" ? "light" : "dark";
}

export const theme = {
  get current() {
    return currentTheme;
  },
  get variant() {
    return currentVariant;
  },
  get available() {
    return THEME_SEEDS.map((s) => s.id);
  },
  get customThemes() {
    return customThemesList;
  },

  apply() {
    applyThemeToDOM(currentTheme, currentVariant, customThemesList);
  },

  set(name: string) {
    currentTheme = name;
    localStorage.setItem(STORAGE_KEY_THEME, name);
    applyThemeToDOM(name, currentVariant, customThemesList);
  },

  setVariant(v: ThemeVariant) {
    currentVariant = v;
    localStorage.setItem(STORAGE_KEY_VARIANT, v);
    applyThemeToDOM(currentTheme, v, customThemesList);
  },

  saveCustomThemes(themes: CustomTheme[]) {
    customThemesList = themes;
    localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(themes));
    applyThemeToDOM(currentTheme, currentVariant, themes);
  },

  deleteCustomTheme(id: string) {
    const next = customThemesList.filter((t) => t.id !== id);
    if (currentTheme === id) this.set(DEFAULT_THEME);
    this.saveCustomThemes(next);
  },
};
