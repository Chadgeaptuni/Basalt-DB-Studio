import {
  THEME_ENTRIES,
  OLED_THEME_ID,
  themeEntry,
  seedOf,
  themeTokens,
  customCategory,
  customSeed,
  type ThemeCategory,
  type CustomColors,
} from "./themeData";

export { THEME_ENTRIES, type ThemeEntry, type ThemeCategory } from "./themeData";

export interface CustomTheme {
  id: string;
  name: string;
  colors: CustomColors;
}

const STORAGE_KEY_THEME = "basalt.theme";
const STORAGE_KEY_VARIANT = "basalt.theme_variant"; // retired; read once to migrate
const STORAGE_KEY_CUSTOM = "basalt.custom_themes";
const DEFAULT_THEME = "basalt-dark";

// The two Basalt families collapsed into one seed when themes became fixed
// appearances, so an old selection has to be pointed at the survivor.
const LEGACY_SEED: Record<string, string> = { "basalt-dark": "basalt", "basalt-light": "basalt" };

function loadCustomThemes(): CustomTheme[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM);
    return raw ? (JSON.parse(raw) as CustomTheme[]) : [];
  } catch {
    return [];
  }
}

/** Resolve a persisted selection to a live theme id, folding away the retired
 *  `theme + variant` pair. Pure so the migration is testable; the caller supplies
 *  what was in storage. */
export function resolveStoredTheme(
  saved: string,
  variant: string | null,
  customIds: string[],
): string {
  // A stored variant means the selection predates fixed themes, so it must be
  // folded even when it looks like a live id — the old seed id "basalt-dark" is
  // also the id of a current theme, and the variant is what disambiguates them.
  if (customIds.includes(saved)) return saved;
  if (!variant) return themeEntry(saved) ? saved : DEFAULT_THEME;
  if (variant === "amoled") return OLED_THEME_ID;

  const seedId = LEGACY_SEED[saved] ?? saved;
  const migrated = `${seedId}-${variant}`;
  if (themeEntry(migrated)) return migrated;
  // The family survived but not in that appearance → keep the family.
  return THEME_ENTRIES.find((e) => e.seedId === seedId)?.id ?? DEFAULT_THEME;
}

/** Runs once at startup, so there is no flash of the wrong theme. */
function loadTheme(customList: CustomTheme[]): string {
  const variant = localStorage.getItem(STORAGE_KEY_VARIANT);
  if (variant) localStorage.removeItem(STORAGE_KEY_VARIANT);
  const id = resolveStoredTheme(
    localStorage.getItem(STORAGE_KEY_THEME) ?? "",
    variant,
    customList.map((t) => t.id),
  );
  localStorage.setItem(STORAGE_KEY_THEME, id);
  return id;
}

const storedCustomThemes = loadCustomThemes();
let customThemesList = $state<CustomTheme[]>(storedCustomThemes);
let currentTheme = $state<string>(loadTheme(storedCustomThemes));

function categoryOf(themeId: string, customList: CustomTheme[]): ThemeCategory {
  const custom = customList.find((t) => t.id === themeId);
  if (custom) return customCategory(custom.colors);
  return themeEntry(themeId)?.category ?? "dark";
}

function applyThemeToDOM(themeId: string, customList: CustomTheme[]): void {
  const root = document.documentElement;
  const custom = customList.find((t) => t.id === themeId);
  const category = categoryOf(themeId, customList);
  const entry = themeEntry(themeId) ?? themeEntry(DEFAULT_THEME)!;
  const seed = custom ? customSeed(custom.id, custom.name, custom.colors) : seedOf(entry);
  const tokens = themeTokens(seed, category);

  for (const [name, value] of Object.entries(tokens)) root.style.setProperty(name, value);
  root.setAttribute("data-theme", themeId);
  root.style.colorScheme = category === "light" ? "light" : "dark";
}

export const theme = {
  get current() {
    return currentTheme;
  },
  get category(): ThemeCategory {
    return categoryOf(currentTheme, customThemesList);
  },
  get isLight() {
    return this.category === "light";
  },
  get customThemes() {
    return customThemesList;
  },

  apply() {
    applyThemeToDOM(currentTheme, customThemesList);
  },

  set(id: string) {
    currentTheme = id;
    localStorage.setItem(STORAGE_KEY_THEME, id);
    applyThemeToDOM(id, customThemesList);
  },

  /** Quick toggle: swap to the other authored appearance of the same family. A
   *  theme with only one appearance (OLED, custom) falls back to Basalt. */
  toggleAppearance() {
    const want: ThemeCategory = this.isLight ? "dark" : "light";
    const seedId = themeEntry(currentTheme)?.seedId;
    const paired =
      seedId && currentTheme !== OLED_THEME_ID
        ? THEME_ENTRIES.find((e) => e.seedId === seedId && e.category === want)
        : undefined;
    this.set(paired?.id ?? `basalt-${want}`);
  },

  saveCustomThemes(themes: CustomTheme[]) {
    customThemesList = themes;
    localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(themes));
    applyThemeToDOM(currentTheme, themes);
  },

  deleteCustomTheme(id: string) {
    const next = customThemesList.filter((t) => t.id !== id);
    if (currentTheme === id) this.set(DEFAULT_THEME);
    this.saveCustomThemes(next);
  },
};
