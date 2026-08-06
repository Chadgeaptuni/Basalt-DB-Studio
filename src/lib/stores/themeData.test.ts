import { describe, it, expect } from "vitest";
import {
  THEME_SEEDS,
  THEME_VARIANTS,
  themeTokens,
  themeSwatch,
  customVariant,
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

    for (const id of ["basalt-dark", "basalt-light", "catppuccin", "dracula", "gruvbox", "claude"]) {
      expect(ids).toContain(id);
    }
  });

  it("emits the full token contract for every seed in every variant", () => {
    for (const seed of THEME_SEEDS) {
      for (const variant of THEME_VARIANTS) {
        const tokens = themeTokens(seed, variant);
        expect(Object.keys(tokens).sort()).toEqual([...CONTRACT].sort());
        for (const value of Object.values(tokens)) {
          expect(typeof value).toBe("string");
          expect(isColor(value)).toBe(true);
        }
      }
    }
  });

  it("makes the AMOLED variant a true-black base for every palette", () => {
    for (const seed of THEME_SEEDS) {
      expect(themeTokens(seed, "amoled")["--surface"]).toBe("#000000");
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
    const basalt = THEME_SEEDS.find((s) => s.id === "basalt-dark")!;
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
    const tokens = themeTokens(seed, customVariant(colors));
    expect(Object.keys(tokens).sort()).toEqual([...CONTRACT].sort());
    expect(tokens["--primary"]).toBe("#4e8cd9");
  });

  it("classifies a custom theme from its authored surface", () => {
    const base = { primary: "#4e8cd9", border: "#2a3240", text: "#111111" };
    expect(customVariant({ ...base, surface: "#f5f6f8" })).toBe("light");
    expect(customVariant({ ...base, surface: "#141820" })).toBe("dark");
  });

  it("returns a three-colour swatch from each seed's headline appearance", () => {
    for (const seed of THEME_SEEDS) {
      const swatch = themeSwatch(seed);
      expect(swatch).toHaveLength(3);
      for (const c of swatch) expect(c.startsWith("#")).toBe(true);
    }
    // lightFirst palettes preview their light background, the rest their dark one.
    expect(themeSwatch(THEME_SEEDS.find((s) => s.id === "basalt-light")!)[0]).toBe("#ffffff");
    expect(themeSwatch(THEME_SEEDS.find((s) => s.id === "catppuccin")!)[0]).toBe("#11111b");
  });
});
