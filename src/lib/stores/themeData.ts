// Single source of truth for every built-in theme.
//
// A *seed* holds the two authored palettes of one colour family; a *theme* is one
// of those palettes, picked directly. Selecting an appearance is the whole choice
// — there is no separate light/dark switch layered on top (DESIGN §3).

export const THEME_CATEGORIES = ["light", "dark", "oled"] as const;
export type ThemeCategory = (typeof THEME_CATEGORIES)[number];

/** Material-ish base palette */
interface BasePalette {
  primary: string;
  onPrimary: string;
  background: string;
  surface: string;
  onSurface: string;
  onSurfaceVariant: string;
  outline: string;
  error: string;
}

interface SyntaxPalette {
  kw: string;
  str: string;
  num: string;
  comment: string;
  fn: string;
}

/** Basalt-only accents. Hues are authored for the dark palette; themeTokens()
 *  nudges them toward the text colour on a light palette (unless the seed
 *  authors its own `lightAccents`) so they keep contrast on a light background. */
interface Accents {
  ok: string;
  warn: string;
  syntax: SyntaxPalette;
}

export interface ThemeSeed {
  id: string;
  name: string;
  description: string;
  light: BasePalette;
  dark: BasePalette;
  accents: Accents;
  /** Set only where a family authors its own light accents; otherwise the dark
   *  accents are nudged toward the text colour (see `themeTokens`). */
  lightAccents?: Accents;
}

export const THEME_SEEDS: ThemeSeed[] = [
  {
    id: "basalt",
    name: "Basalt",
    description: "Default flat palette with high contrast.",
    light: { primary: "#2f6fd0", onPrimary: "#ffffff", background: "#ffffff", surface: "#e9ebef", onSurface: "#1c2530", onSurfaceVariant: "#3d4757", outline: "#cdd2da", error: "#c0392b" },
    dark: { primary: "#4e8cd9", onPrimary: "#ffffff", background: "#0e1116", surface: "#1e242e", onSurface: "#e6e9ef", onSurfaceVariant: "#b6bdc9", outline: "#323b47", error: "#e06c75" },
    accents: { ok: "#6cc070", warn: "#d6a55c", syntax: { kw: "#7aa2f7", str: "#9ece6a", num: "#ff9e64", comment: "#5c6370", fn: "#7dcfff" } },
    lightAccents: { ok: "#2e8b57", warn: "#b8860b", syntax: { kw: "#0b5fb3", str: "#297a3a", num: "#b25000", comment: "#8a919e", fn: "#0a7ea4" } },
  },
  {
    id: "basalt-nord",
    name: "Basalt Nord",
    description: "Cool Nordic palette with arctic blue accents.",
    light: { primary: "#5e81ac", onPrimary: "#ffffff", background: "#eceff4", surface: "#e5e9f0", onSurface: "#2e3440", onSurfaceVariant: "#4c566a", outline: "#c3cad5", error: "#bf616a" },
    dark: { primary: "#88c0d0", onPrimary: "#2e3440", background: "#2e3440", surface: "#3b4252", onSurface: "#eceff4", onSurfaceVariant: "#d8dee9", outline: "#4c566a", error: "#bf616a" },
    accents: { ok: "#a3be8c", warn: "#ebcb8b", syntax: { kw: "#81a1c1", str: "#a3be8c", num: "#d08770", comment: "#616e88", fn: "#8fbcbb" } },
  },
  {
    id: "basalt-paper",
    name: "Basalt Paper",
    description: "Warm paper theme with soft sepia contrast.",
    light: { primary: "#a65d00", onPrimary: "#ffffff", background: "#faf7f0", surface: "#e8e1d3", onSurface: "#2b2620", onSurfaceVariant: "#4d463b", outline: "#c9bfab", error: "#b23b3b" },
    dark: { primary: "#d9973a", onPrimary: "#2a1c08", background: "#1a1611", surface: "#241f18", onSurface: "#ece4d5", onSurfaceVariant: "#b9ad98", outline: "#4a4234", error: "#e08a7d" },
    accents: { ok: "#4f8a3d", warn: "#9a6b12", syntax: { kw: "#1e6fb8", str: "#2f7d32", num: "#b5591f", comment: "#9a9180", fn: "#0f8a8a" } },
  },
  {
    id: "catppuccin",
    name: "Catppuccin",
    description: "Soothing pastel theme with lavender highlights.",
    light: { primary: "#8839ef", onPrimary: "#ffffff", background: "#eff1f5", surface: "#e6e9ef", onSurface: "#4c4f69", onSurfaceVariant: "#6c6f85", outline: "#bcc0cc", error: "#d20f39" },
    dark: { primary: "#cba6f7", onPrimary: "#1e1e2e", background: "#11111b", surface: "#1e1e2e", onSurface: "#cdd6f4", onSurfaceVariant: "#a6adc8", outline: "#45475a", error: "#f38ba8" },
    accents: { ok: "#a6e3a1", warn: "#f9e2af", syntax: { kw: "#cba6f7", str: "#a6e3a1", num: "#fab387", comment: "#6c7086", fn: "#89b4fa" } },
  },
  {
    id: "monochrome",
    name: "Monochrome",
    description: "High contrast black and white minimal style.",
    light: { primary: "#202020", onPrimary: "#ffffff", background: "#ffffff", surface: "#f2f2f2", onSurface: "#111111", onSurfaceVariant: "#575757", outline: "#d2d2d2", error: "#a62b2b" },
    dark: { primary: "#eeeeee", onPrimary: "#111111", background: "#111111", surface: "#1d1d1d", onSurface: "#f3f3f3", onSurfaceVariant: "#bcbcbc", outline: "#3a3a3a", error: "#e06c6c" },
    accents: { ok: "#88c088", warn: "#d0b080", syntax: { kw: "#f3f3f3", str: "#cccccc", num: "#dddddd", comment: "#666666", fn: "#e0e0e0" } },
  },
  {
    id: "green-apple",
    name: "Green Apple",
    description: "Fresh green palette inspired by nature.",
    light: { primary: "#3f7d20", onPrimary: "#ffffff", background: "#fbfff7", surface: "#eef6e8", onSurface: "#17210f", onSurfaceVariant: "#53614a", outline: "#c7d7bb", error: "#ba1a1a" },
    dark: { primary: "#a5d66a", onPrimary: "#1d3700", background: "#10150c", surface: "#1a2214", onSurface: "#e7f0df", onSurfaceVariant: "#bdcbb3", outline: "#3b4932", error: "#ffb4ab" },
    accents: { ok: "#a5d66a", warn: "#e7c468", syntax: { kw: "#a5d66a", str: "#89b75a", num: "#d4e157", comment: "#5f7053", fn: "#7cb342" } },
  },
  {
    id: "lavender",
    name: "Lavender",
    description: "Soft purple tones with gentle contrast.",
    light: { primary: "#7357a4", onPrimary: "#ffffff", background: "#fdf9ff", surface: "#f3edfa", onSurface: "#211a29", onSurfaceVariant: "#62586c", outline: "#d0c4db", error: "#ba1a1a" },
    dark: { primary: "#d2b8ff", onPrimary: "#3e246c", background: "#151119", surface: "#211a28", onSurface: "#eee6f2", onSurfaceVariant: "#cabfd0", outline: "#4a4053", error: "#ffb4ab" },
    accents: { ok: "#9cdb9c", warn: "#e4c382", syntax: { kw: "#d2b8ff", str: "#bea4e6", num: "#f0a8d0", comment: "#74677e", fn: "#b892ff" } },
  },
  {
    id: "tako",
    name: "Tako",
    description: "Deep violet palette with vibrant accents.",
    light: { primary: "#6650a4", onPrimary: "#ffffff", background: "#fff7ff", surface: "#f6eef8", onSurface: "#211f26", onSurfaceVariant: "#625b67", outline: "#cac2cf", error: "#ba1a1a" },
    dark: { primary: "#d0bcff", onPrimary: "#381e72", background: "#17131c", surface: "#221d29", onSurface: "#e9e1eb", onSurfaceVariant: "#ccc3d0", outline: "#4b4450", error: "#ffb4ab" },
    accents: { ok: "#a0d8a0", warn: "#e8b9c7", syntax: { kw: "#d0bcff", str: "#e8b9c7", num: "#f2a6c2", comment: "#766a7b", fn: "#b69df8" } },
  },
  {
    id: "yin-yang",
    name: "Yin & Yang",
    description: "Pure black contrast with bright highlights.",
    light: { primary: "#343434", onPrimary: "#ffffff", background: "#fafafa", surface: "#ededed", onSurface: "#151515", onSurfaceVariant: "#5b5b5b", outline: "#cccccc", error: "#b3261e" },
    dark: { primary: "#fafafa", onPrimary: "#171717", background: "#0b0b0b", surface: "#171717", onSurface: "#f5f5f5", onSurfaceVariant: "#bdbdbd", outline: "#383838", error: "#f2b8b5" },
    accents: { ok: "#88c088", warn: "#d2b48c", syntax: { kw: "#f5f5f5", str: "#c7c7c7", num: "#e0e0e0", comment: "#5f5f5f", fn: "#dbdbdb" } },
  },
  {
    id: "strawberry-daiquiri",
    name: "Strawberry Daiquiri",
    description: "Crimson pink accents over quiet surfaces.",
    light: { primary: "#b3264f", onPrimary: "#ffffff", background: "#fff8f8", surface: "#fcebed", onSurface: "#28171b", onSurfaceVariant: "#6b555b", outline: "#dbc0c7", error: "#ba1a1a" },
    dark: { primary: "#ffb1c3", onPrimary: "#67002b", background: "#1c1013", surface: "#291a1e", onSurface: "#f4dfe4", onSurfaceVariant: "#d6c0c6", outline: "#523b41", error: "#ffb4ab" },
    accents: { ok: "#a3db9e", warn: "#e8b8c4", syntax: { kw: "#ffb1c3", str: "#e8b8c4", num: "#ff8fa3", comment: "#7d6268", fn: "#ff9ebb" } },
  },
  {
    id: "kanagawa",
    name: "Kanagawa",
    description: "Rich autumn colors inspired by traditional art.",
    light: { primary: "#6f5c2f", onPrimary: "#ffffff", background: "#f2ecdc", surface: "#e7dfcf", onSurface: "#36322b", onSurfaceVariant: "#6f685b", outline: "#c5baa5", error: "#c34043" },
    dark: { primary: "#e6c384", onPrimary: "#282727", background: "#1f1f28", surface: "#2a2a37", onSurface: "#dcd7ba", onSurfaceVariant: "#c8c093", outline: "#54546d", error: "#e46876" },
    accents: { ok: "#98bb6c", warn: "#ffa066", syntax: { kw: "#957fb8", str: "#98bb6c", num: "#ffa066", comment: "#727169", fn: "#7e9cd8" } },
  },
  {
    id: "tokyo-night",
    name: "Tokyo Night",
    description: "Vibrant neon blue and purple night style.",
    light: { primary: "#34548a", onPrimary: "#ffffff", background: "#d5d6db", surface: "#cbccd1", onSurface: "#343b58", onSurfaceVariant: "#596172", outline: "#a8abb5", error: "#8c4351" },
    dark: { primary: "#7aa2f7", onPrimary: "#10121b", background: "#16161e", surface: "#1f2335", onSurface: "#c0caf5", onSurfaceVariant: "#a9b1d6", outline: "#3b4261", error: "#f7768e" },
    accents: { ok: "#9ece6a", warn: "#e0af68", syntax: { kw: "#bb9af7", str: "#9ece6a", num: "#ff9e64", comment: "#565f89", fn: "#7dcfff" } },
  },
  {
    id: "rose-pine",
    name: "Rosé Pine",
    description: "Warm aesthetic with muted rose tones.",
    light: { primary: "#907aa9", onPrimary: "#ffffff", background: "#faf4ed", surface: "#f2e9e1", onSurface: "#575279", onSurfaceVariant: "#797593", outline: "#cecacd", error: "#b4637a" },
    dark: { primary: "#c4a7e7", onPrimary: "#191724", background: "#191724", surface: "#26233a", onSurface: "#e0def4", onSurfaceVariant: "#908caa", outline: "#403d52", error: "#eb6f92" },
    accents: { ok: "#9ccfd8", warn: "#f6c177", syntax: { kw: "#c4a7e7", str: "#ebbcba", num: "#f6c177", comment: "#6e6a86", fn: "#9ccfd8" } },
  },
  {
    id: "everforest",
    name: "Everforest",
    description: "Comforting natural green theme with soft contrast.",
    light: { primary: "#8da101", onPrimary: "#ffffff", background: "#fdf6e3", surface: "#f4f0d9", onSurface: "#5c6a72", onSurfaceVariant: "#829181", outline: "#d3cdb2", error: "#f85552" },
    dark: { primary: "#a7c080", onPrimary: "#1e2326", background: "#1e2326", surface: "#272e33", onSurface: "#d3c6aa", onSurfaceVariant: "#9da9a0", outline: "#414b50", error: "#e67e80" },
    accents: { ok: "#a7c080", warn: "#dbbc7f", syntax: { kw: "#e67e80", str: "#a7c080", num: "#e69875", comment: "#707d75", fn: "#7fbbb3" } },
  },
  {
    id: "gruvbox",
    name: "Gruvbox",
    description: "Classic retro palette with warm accents.",
    light: { primary: "#b57614", onPrimary: "#ffffff", background: "#fbf1c7", surface: "#ebdbb2", onSurface: "#3c3836", onSurfaceVariant: "#665c54", outline: "#d5c4a1", error: "#cc241d" },
    dark: { primary: "#fabd2f", onPrimary: "#282828", background: "#1d2021", surface: "#282828", onSurface: "#ebdbb2", onSurfaceVariant: "#bdae93", outline: "#504945", error: "#fb4934" },
    accents: { ok: "#b8bb26", warn: "#fe8019", syntax: { kw: "#fb4934", str: "#b8bb26", num: "#d3869b", comment: "#928374", fn: "#8ec07c" } },
  },
  {
    id: "dracula",
    name: "Dracula",
    description: "Famous palette with vivid purple accents.",
    light: { primary: "#6d4aa2", onPrimary: "#ffffff", background: "#f8f7fb", surface: "#eceaf2", onSurface: "#282a36", onSurfaceVariant: "#626473", outline: "#cfccd8", error: "#c93654" },
    dark: { primary: "#bd93f9", onPrimary: "#282a36", background: "#21222c", surface: "#282a36", onSurface: "#f8f8f2", onSurfaceVariant: "#c5c8d4", outline: "#44475a", error: "#ff5555" },
    accents: { ok: "#50fa7b", warn: "#f1fa8c", syntax: { kw: "#ff79c6", str: "#f1fa8c", num: "#bd93f9", comment: "#626473", fn: "#8be9fd" } },
  },
  {
    id: "solarized",
    name: "Solarized",
    description: "Precision cyan theme with low contrast fatigue.",
    light: { primary: "#268bd2", onPrimary: "#ffffff", background: "#fdf6e3", surface: "#eee8d5", onSurface: "#586e75", onSurfaceVariant: "#657b83", outline: "#d6cfb8", error: "#dc322f" },
    dark: { primary: "#2aa198", onPrimary: "#002b36", background: "#002b36", surface: "#073642", onSurface: "#eee8d5", onSurfaceVariant: "#93a1a1", outline: "#335963", error: "#dc322f" },
    accents: { ok: "#859900", warn: "#b58900", syntax: { kw: "#268bd2", str: "#2aa198", num: "#d33682", comment: "#586e75", fn: "#b58900" } },
  },
  {
    id: "tide",
    name: "Tide",
    description: "Deep ocean cyan palette with cool tones.",
    light: { primary: "#247f83", onPrimary: "#ffffff", background: "#f4fbfb", surface: "#e5f1f1", onSurface: "#183638", onSurfaceVariant: "#587173", outline: "#bfd1d1", error: "#ba1a1a" },
    dark: { primary: "#78c6c5", onPrimary: "#093737", background: "#101a1c", surface: "#182529", onSurface: "#dce8e8", onSurfaceVariant: "#aabbbb", outline: "#34474b", error: "#ffb4ab" },
    accents: { ok: "#78c6c5", warn: "#e0c878", syntax: { kw: "#78c6c5", str: "#97b8b8", num: "#a3d9d8", comment: "#587173", fn: "#5c8f91" } },
  },
  {
    id: "sage",
    name: "Sage",
    description: "Muted botanical sage green theme.",
    light: { primary: "#5d7456", onPrimary: "#ffffff", background: "#f7faf4", surface: "#ebf0e7", onSurface: "#20281d", onSurfaceVariant: "#5d6858", outline: "#c5cec0", error: "#ba1a1a" },
    dark: { primary: "#b4cda9", onPrimary: "#21351d", background: "#121812", surface: "#1c251d", onSurface: "#e2e9df", onSurfaceVariant: "#bec8ba", outline: "#3b493a", error: "#ffb4ab" },
    accents: { ok: "#b4cda9", warn: "#dec076", syntax: { kw: "#b4cda9", str: "#aebfa7", num: "#cce0c3", comment: "#5d6858", fn: "#778870" } },
  },
  {
    id: "caffeine",
    name: "Caffeine",
    description: "Warm espresso brown palette with soft tones.",
    light: { primary: "#795548", onPrimary: "#ffffff", background: "#fffaf6", surface: "#f3e9e1", onSurface: "#30231e", onSurfaceVariant: "#6d5a51", outline: "#d7c4b9", error: "#ba1a1a" },
    dark: { primary: "#e6c2aa", onPrimary: "#442a1e", background: "#15110f", surface: "#221a17", onSurface: "#eee4df", onSurfaceVariant: "#cdbdb5", outline: "#493a34", error: "#ffb4ab" },
    accents: { ok: "#a8d59d", warn: "#e0b878", syntax: { kw: "#e6c2aa", str: "#c7a797", num: "#f0cfbb", comment: "#6d5a51", fn: "#9a6f5d" } },
  },
  {
    id: "claude",
    name: "Claude",
    description: "Warm terracotta theme with amber accents.",
    light: { primary: "#c15f3c", onPrimary: "#ffffff", background: "#f7f4ef", surface: "#ece7df", onSurface: "#2f2926", onSurfaceVariant: "#6b605b", outline: "#d2c9c0", error: "#b3261e" },
    dark: { primary: "#e07a58", onPrimary: "#2b1510", background: "#1d1b19", surface: "#282522", onSurface: "#eee9e5", onSurfaceVariant: "#c8beb8", outline: "#4b4541", error: "#ffb4ab" },
    accents: { ok: "#a2d29b", warn: "#e5b078", syntax: { kw: "#e07a58", str: "#b9a49b", num: "#f09575", comment: "#6b605b", fn: "#c15f3c" } },
  },
];

/** Default colours for a brand-new custom theme (the color-picker start state). */
export const DEFAULT_CUSTOM_COLORS = {
  primary: "#4e8cd9",
  surface: "#141820",
  border: "#2a3240",
  text: "#e6e9ef",
} as const;

// OLED surfaces: true-black base + near-black raised, retaining the Basalt dark
// accents/text. One preset, not a modifier applied to every palette.
const OLED = { surface: "#000000", container: "#0b0b0b", containerHigh: "#151515" } as const;
export const OLED_THEME_ID = "basalt-oled";

const mix = (color: string, pct: number, into: string): string =>
  `color-mix(in srgb, ${color} ${pct}%, ${into})`;

/**
 * Map a seed + category to the full Basalt token contract (DESIGN.md §3). The one
 * derivation point: surfaces build a 5-level tonal ladder, borders/grid/danger are
 * mixed from the palette, and accent/syntax hues are nudged toward the text colour
 * on a light palette so they retain contrast on a light background.
 */
export function themeTokens(seed: ThemeSeed, category: ThemeCategory): Record<string, string> {
  const light = category === "light";
  const oled = category === "oled";
  const base = light ? seed.light : seed.dark; // oled builds on the dark palette

  const background = oled ? OLED.surface : base.background;
  const surface = oled ? OLED.containerHigh : base.surface;
  const panel = oled ? OLED.container : mix(base.surface, light ? 58 : 72, base.background);

  // Authored light accents win; otherwise pull hues toward onSurface (a dark tone)
  // so they keep contrast on a light background. Dark/OLED use them as authored.
  const accents = light ? (seed.lightAccents ?? seed.accents) : seed.accents;
  const nudge = light && !seed.lightAccents;
  const forLight = (c: string): string => (nudge ? mix(c, 78, base.onSurface) : c);
  const s = accents.syntax;

  return {
    "--surface": background,
    "--surface-container-low": mix(panel, 50, background),
    "--surface-container": panel,
    "--surface-container-high": surface,
    "--surface-container-highest": mix(base.onSurface, light ? 7 : 9, surface),

    "--on-surface": base.onSurface,
    "--on-surface-variant": base.onSurfaceVariant,
    "--on-surface-muted": mix(base.onSurfaceVariant, 60, surface),

    "--outline-variant": mix(base.outline, 58, surface),
    "--outline": base.outline,

    "--primary": base.primary,
    "--on-primary": base.onPrimary,
    // Tonal (filled-tonal buttons, chips, selected rows): a low-chroma wash of
    // primary over the panel. On a dark palette `primary` is already light
    // enough to read on that wash; on a light one it must be pulled darker.
    "--primary-container": mix(base.primary, light ? 14 : 22, surface),
    "--on-primary-container": light ? mix(base.primary, 82, base.onSurface) : base.primary,

    "--secondary-container": mix(base.primary, light ? 7 : 10, surface),
    "--on-secondary-container": base.onSurface,

    "--error": base.error,
    "--on-error": light ? "#ffffff" : background,
    "--error-container": mix(base.error, 15, background),
    "--on-error-container": light ? mix(base.error, 82, base.onSurface) : base.error,

    "--ok": forLight(accents.ok),
    "--warn": forLight(accents.warn),

    "--grid-header-bg": mix(surface, 22, background),
    "--grid-row-alt": mix(surface, 12, background),
    "--grid-sel": mix(base.primary, light ? 16 : 22, surface),
    "--grid-null": mix(base.onSurfaceVariant, 55, background),
    "--grid-edited": mix(forLight(accents.warn), 20, background),

    "--syntax-kw": forLight(s.kw),
    "--syntax-str": forLight(s.str),
    "--syntax-num": forLight(s.num),
    "--syntax-comment": nudge ? mix(s.comment, 72, base.onSurface) : s.comment,
    "--syntax-fn": forLight(s.fn),
    "--syntax-ident": base.onSurface,
  };
}

/** One selectable theme: a seed rendered in one of its authored appearances. */
export interface ThemeEntry {
  id: string;
  seedId: string;
  name: string;
  description: string;
  category: ThemeCategory;
}

const seedById = new Map(THEME_SEEDS.map((s) => [s.id, s]));

/** Every built-in theme: both appearances of every seed, plus the one OLED preset. */
export const THEME_ENTRIES: ThemeEntry[] = [
  ...THEME_SEEDS.flatMap((seed): ThemeEntry[] => [
    {
      id: `${seed.id}-light`,
      seedId: seed.id,
      name: `${seed.name} Light`,
      description: seed.description,
      category: "light",
    },
    {
      id: `${seed.id}-dark`,
      seedId: seed.id,
      name: `${seed.name} Dark`,
      description: seed.description,
      category: "dark",
    },
  ]),
  {
    id: OLED_THEME_ID,
    seedId: "basalt",
    name: "Basalt OLED",
    description: "True black surfaces for OLED panels.",
    category: "oled",
  },
];

export function themeEntry(id: string): ThemeEntry | undefined {
  return THEME_ENTRIES.find((e) => e.id === id);
}

export function seedOf(entry: ThemeEntry): ThemeSeed {
  return seedById.get(entry.seedId)!;
}

/** The three-swatch preview the picker draws — read from the appearance the row
 *  actually selects, so the swatch can never disagree with the result. */
export function themeSwatch(entry: ThemeEntry): [string, string, string] {
  const seed = seedOf(entry);
  const base = entry.category === "light" ? seed.light : seed.dark;
  return [entry.category === "oled" ? OLED.surface : base.background, base.primary, base.outline];
}

/** Perceptual lightness of a #rrggbb colour, 0 (black) → 1 (white). */
export function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  const n = Number.parseInt(m[1], 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

/** The four colours a user picks for a custom theme. */
export interface CustomColors {
  primary: string;
  surface: string;
  border: string;
  text: string;
}

/** A custom theme is Light or Dark by its authored surface — read the raw hex the
 *  user picked, never the expanded palette (whose derived fields are
 *  `color-mix()` strings that `luminance` cannot parse). */
export function customCategory(c: CustomColors): ThemeCategory {
  return luminance(c.surface) > 0.5 ? "light" : "dark";
}

/**
 * Expand a 4-colour custom theme into a full seed so it drives the whole token
 * contract (not just a handful) — otherwise switching to a custom theme would
 * leave the previous theme's grid/syntax tokens behind. Both appearances hold the
 * same authored palette, so the theme renders exactly as the user drew it.
 */
export function customSeed(id: string, name: string, c: CustomColors): ThemeSeed {
  const light = customCategory(c) === "light";
  const palette: BasePalette = {
    primary: c.primary,
    onPrimary: luminance(c.primary) > 0.6 ? "#111111" : "#ffffff",
    background: mix(c.surface, light ? 40 : 82, light ? "#ffffff" : "#000000"),
    surface: c.surface,
    onSurface: c.text,
    onSurfaceVariant: mix(c.text, 72, c.surface),
    outline: c.border,
    error: "#e06c75",
  };
  return {
    id,
    name,
    description: "User custom theme",
    light: palette,
    dark: palette,
    accents: {
      ok: "#6cc070",
      warn: "#d6a55c",
      syntax: {
        kw: c.primary,
        str: mix(c.primary, 55, c.text),
        num: c.primary,
        comment: mix(c.text, 45, c.surface),
        fn: c.primary,
      },
    },
  };
}
