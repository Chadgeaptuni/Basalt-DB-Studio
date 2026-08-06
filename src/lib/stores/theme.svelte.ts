import {
  THEME_SEEDS,
  THEME_VARIANTS,
  themeTokens,
  customSeed,
  customVariant,
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

// The build that dropped variants baked the appearance into the id and gave OLED
// its own entry; those ids are still in users' localStorage.
const FLAT_OLED_ID = "basalt-oled";

const seedById = new Map(THEME_SEEDS.map((s) => [s.id, s]));

function loadCustomThemes(): CustomTheme[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM);
    return raw ? (JSON.parse(raw) as CustomTheme[]) : [];
  } catch {
    return [];
  }
}

/** Resolve what is in storage to a live theme + variant pair, unfolding an id
 *  written by the flat-theme build. Pure so the migration is testable; the caller
 *  supplies what was in storage. */
export function resolveStoredSelection(
  saved: string,
  storedVariant: string | null,
  customIds: string[],
): { theme: string; variant: ThemeVariant } {
  // A stored variant means the selection already is a pair — the id is a palette,
  // never an appearance, so it needs no unfolding.
  if (storedVariant && (THEME_VARIANTS as readonly string[]).includes(storedVariant)) {
    const known = customIds.includes(saved) || seedById.has(saved);
    return { theme: known ? saved : DEFAULT_THEME, variant: storedVariant as ThemeVariant };
  }

  if (customIds.includes(saved)) return { theme: saved, variant: "dark" };
  if (saved === FLAT_OLED_ID) return { theme: DEFAULT_THEME, variant: "amoled" };

  // `<palette>-light` / `<palette>-dark` unfolds — but only when the stem is a
  // real palette, so the "basalt-dark" / "basalt-light" seeds (whose own ids end
  // that way) fall through to the exact match below instead of being split.
  const flat = /^(.*)-(light|dark)$/.exec(saved);
  if (flat && seedById.has(flat[1])) {
    return { theme: flat[1], variant: flat[2] as ThemeVariant };
  }

  const seed = seedById.get(saved);
  if (seed) return { theme: saved, variant: seed.lightFirst ? "light" : "dark" };
  return { theme: DEFAULT_THEME, variant: "dark" };
}

/** Runs once at startup, so there is no flash of the wrong theme. */
function loadSelection(customList: CustomTheme[]): { theme: string; variant: ThemeVariant } {
  const selection = resolveStoredSelection(
    localStorage.getItem(STORAGE_KEY_THEME) ?? "",
    localStorage.getItem(STORAGE_KEY_VARIANT),
    customList.map((t) => t.id),
  );
  localStorage.setItem(STORAGE_KEY_THEME, selection.theme);
  localStorage.setItem(STORAGE_KEY_VARIANT, selection.variant);
  return selection;
}

const storedCustomThemes = loadCustomThemes();
const storedSelection = loadSelection(storedCustomThemes);

let customThemesList = $state<CustomTheme[]>(storedCustomThemes);
let currentTheme = $state<string>(storedSelection.theme);
let currentVariant = $state<ThemeVariant>(storedSelection.variant);

function resolveSeed(
  themeId: string,
  variant: ThemeVariant,
  customList: CustomTheme[],
): { seed: ThemeSeed; variant: ThemeVariant } {
  const custom = customList.find((t) => t.id === themeId);
  // Custom themes have no light/dark inversion: they render as the user authored
  // them, whichever variant is selected (AMOLED still blackens the surfaces).
  if (custom) {
    return {
      seed: customSeed(custom.id, custom.name, custom.colors),
      variant: variant === "amoled" ? "amoled" : customVariant(custom.colors),
    };
  }
  return { seed: seedById.get(themeId) ?? seedById.get(DEFAULT_THEME)!, variant };
}

function applyThemeToDOM(themeId: string, variant: ThemeVariant, customList: CustomTheme[]): void {
  const root = document.documentElement;
  const resolved = resolveSeed(themeId, variant, customList);
  const tokens = themeTokens(resolved.seed, resolved.variant);

  for (const [name, value] of Object.entries(tokens)) root.style.setProperty(name, value);
  root.setAttribute("data-theme", themeId);
  root.setAttribute("data-variant", variant);
  root.style.colorScheme = resolved.variant === "light" ? "light" : "dark";
}

export const theme = {
  get current() {
    return currentTheme;
  },
  get variant() {
    return currentVariant;
  },
  get isLight() {
    return currentVariant === "light";
  },
  get customThemes() {
    return customThemesList;
  },

  apply() {
    applyThemeToDOM(currentTheme, currentVariant, customThemesList);
  },

  set(id: string) {
    currentTheme = id;
    localStorage.setItem(STORAGE_KEY_THEME, id);
    applyThemeToDOM(id, currentVariant, customThemesList);
  },

  setVariant(v: ThemeVariant) {
    currentVariant = v;
    localStorage.setItem(STORAGE_KEY_VARIANT, v);
    applyThemeToDOM(currentTheme, v, customThemesList);
  },

  /** Quick toggle for the top-bar sun/moon button — AMOLED is reachable only from
   *  the picker, so it toggles into light like any other dark variant.
   *
   *  Self-references go through `theme`, not `this`: call sites pass these methods
   *  straight to `onclick={theme.toggleAppearance}`, which detaches the receiver
   *  and would make `this` undefined. */
  toggleAppearance() {
    theme.setVariant(theme.isLight ? "dark" : "light");
  },

  saveCustomThemes(themes: CustomTheme[]) {
    customThemesList = themes;
    localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(themes));
    applyThemeToDOM(currentTheme, currentVariant, themes);
  },

  deleteCustomTheme(id: string) {
    const next = customThemesList.filter((t) => t.id !== id);
    if (currentTheme === id) theme.set(DEFAULT_THEME);
    theme.saveCustomThemes(next);
  },
};
