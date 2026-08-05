// Picker metadata derived from the single source of truth (themeData.ts). The
// swatch colours are read from each entry — no duplicated hex tables here.

import { THEME_ENTRIES, themeSwatch, type ThemeCategory } from "$lib/stores/themeData";

export interface ThemeDefinition {
  id: string;
  name: string;
  description: string;
  /** [background, accent, outline] — the preview swatch of what the row selects. */
  colors: [string, string, string];
}

export interface ThemeSection {
  category: ThemeCategory;
  title: string;
  items: ThemeDefinition[];
}

const TITLES: Record<ThemeCategory, string> = { light: "Light", dark: "Dark", oled: "OLED" };

export const THEME_SECTIONS: ThemeSection[] = (["light", "dark", "oled"] as const).map(
  (category) => ({
    category,
    title: TITLES[category],
    items: THEME_ENTRIES.filter((e) => e.category === category).map((entry) => ({
      id: entry.id,
      name: entry.name,
      description: entry.description,
      colors: themeSwatch(entry),
    })),
  }),
);
