import { describe, it, expect } from "vitest";
import {
  THEME_SEEDS,
  THEME_ENTRIES,
  THEME_CATEGORIES,
  OLED_THEME_ID,
  themeEntry,
  themeTokens,
  themeSwatch,
  customCategory,
  customSeed,
} from "./themeData";

// Every token in the DESIGN.md §3 contract; themeTokens must emit all of them.
const CONTRACT = [
  "--surface", "--surface-container-low", "--surface-container",
  "--surface-container-high", "--surface-container-highest",
  "--on-surface", "--on-surface-variant", "--on-surface-muted",
  "--outline-variant", "--outline",
  "--primary", "--on-primary", "--primary-container", "--on-primary-container",
  "--secondary-container", "--on-secondary-container",
  "--error", "--on-error", "--error-container", "--on-error-container",
  "--ok", "--warn",
  "--grid-header-bg", "--grid-row-alt", "--grid-sel", "--grid-null", "--grid-edited",
  "--syntax-kw", "--syntax-str", "--syntax-num", "--syntax-comment", "--syntax-fn", "--syntax-ident",
] as const;

const isColor = (v: string) => v.startsWith("#") || v.startsWith("color-mix(");

describe("themeData", () => {
  it("ships the built-in palettes with unique ids", () => {
    expect(THEME_SEEDS.length).toBeGreaterThanOrEqual(21);
    expect(new Set(THEME_SEEDS.map((s) => s.id)).size).toBe(THEME_SEEDS.length);
    const ids = THEME_SEEDS.map((s) => s.id);

    for (const id of ["basalt", "catppuccin", "dracula", "gruvbox", "claude"]) {
      expect(ids).toContain(id);
    }
  });

  it("flattens every seed into one entry per authored appearance, plus OLED", () => {
    expect(THEME_ENTRIES).toHaveLength(THEME_SEEDS.length * 2 + 1);
    expect(new Set(THEME_ENTRIES.map((e) => e.id)).size).toBe(THEME_ENTRIES.length);
    expect(themeEntry(OLED_THEME_ID)?.category).toBe("oled");

    // Each entry belongs to exactly one section, and every category is populated.
    for (const category of THEME_CATEGORIES) {
      expect(THEME_ENTRIES.some((e) => e.category === category)).toBe(true);
    }
    // The ids an old theme+variant selection migrates to must exist.
    for (const id of ["basalt-dark", "basalt-light", "catppuccin-light", "dracula-dark"]) {
      expect(themeEntry(id)).toBeDefined();
    }
  });

  it("emits the full token contract for every entry", () => {
    for (const entry of THEME_ENTRIES) {
      const seed = THEME_SEEDS.find((s) => s.id === entry.seedId)!;
      const tokens = themeTokens(seed, entry.category);
      expect(Object.keys(tokens).sort()).toEqual([...CONTRACT].sort());
      for (const value of Object.values(tokens)) {
        expect(typeof value).toBe("string");
        expect(isColor(value)).toBe(true);
      }
    }
  });

  it("makes the OLED appearance a true-black base", () => {
    for (const seed of THEME_SEEDS) {
      expect(themeTokens(seed, "oled")["--surface"]).toBe("#000000");
    }
  });

  it("gives each seed a distinct light and dark surface", () => {
    for (const seed of THEME_SEEDS) {
      const light = themeTokens(seed, "light");
      const dark = themeTokens(seed, "dark");
      expect(light["--surface"]).not.toBe(dark["--surface"]);
    }
  });

  it("maps palettes to their exact seed colours", () => {
    const catppuccin = THEME_SEEDS.find((s) => s.id === "catppuccin")!;
    const darkTokens = themeTokens(catppuccin, "dark");
    expect(darkTokens["--surface"]).toBe("#11111b"); // background
    expect(darkTokens["--primary"]).toBe("#cba6f7"); // primary
    expect(darkTokens["--error"]).toBe("#f38ba8"); // error
    expect(themeTokens(catppuccin, "light")["--surface"]).toBe("#eff1f5");

    const dracula = THEME_SEEDS.find((s) => s.id === "dracula")!;
    expect(themeTokens(dracula, "dark")["--primary"]).toBe("#bd93f9");
  });

  it("uses a seed's authored light accents instead of nudging them", () => {
    const basalt = THEME_SEEDS.find((s) => s.id === "basalt")!;
    expect(themeTokens(basalt, "light")["--syntax-kw"]).toBe("#0b5fb3"); // authored
    expect(themeTokens(basalt, "dark")["--syntax-kw"]).toBe("#7aa2f7");
  });

  it("expands a 4-colour custom theme into the full contract", () => {
    const colors = {
      primary: "#4e8cd9",
      surface: "#141820",
      border: "#2a3240",
      text: "#e6e9ef",
    };
    const seed = customSeed("custom-x", "Mine", colors);
    const tokens = themeTokens(seed, customCategory(colors));
    expect(Object.keys(tokens).sort()).toEqual([...CONTRACT].sort());
    expect(tokens["--primary"]).toBe("#4e8cd9");
  });

  it("classifies a custom theme from its authored surface", () => {
    const base = { primary: "#4e8cd9", border: "#2a3240", text: "#111111" };
    expect(customCategory({ ...base, surface: "#f5f6f8" })).toBe("light");
    expect(customCategory({ ...base, surface: "#141820" })).toBe("dark");
  });

  it("returns a three-colour swatch matching the entry's appearance", () => {
    for (const entry of THEME_ENTRIES) {
      const swatch = themeSwatch(entry);
      expect(swatch).toHaveLength(3);
      for (const c of swatch) expect(c.startsWith("#")).toBe(true);
    }
    expect(themeSwatch(themeEntry(OLED_THEME_ID)!)[0]).toBe("#000000");
    expect(themeSwatch(themeEntry("catppuccin-light")!)[0]).toBe("#eff1f5");
    expect(themeSwatch(themeEntry("catppuccin-dark")!)[0]).toBe("#11111b");
  });
});
