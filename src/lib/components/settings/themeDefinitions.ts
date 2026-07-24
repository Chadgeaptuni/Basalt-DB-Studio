// Picker metadata derived from the single source of truth (themeData.ts). The
// swatch colours are read from each seed — no duplicated hex tables here.

import { THEME_SEEDS, themeSwatch } from "$lib/stores/themeData";

export interface ThemeDefinition {
  id: string;
  name: string;
  description: string;
  /** [background, accent, outline] — the inactive-theme preview swatch. */
  colors: [string, string, string];
}

export const THEME_DEFINITIONS: ThemeDefinition[] = THEME_SEEDS.map((seed) => ({
  id: seed.id,
  name: seed.name,
  description: seed.description,
  colors: themeSwatch(seed),
}));
