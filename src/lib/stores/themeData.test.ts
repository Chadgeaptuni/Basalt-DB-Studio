import { describe, it, expect } from "vitest";
import {
  THEME_SEEDS,
  THEME_VARIANTS,
  themeTokens,
  themeSwatch,
  customSeed,
} from "./themeData";

// Every token in the DESIGN.md §3 contract; themeTokens must emit all of them.
const CONTRACT = [
  "--bg-0", "--bg-1", "--bg-2",
  "--fg-0", "--fg-1", "--fg-2",
  "--border", "--border-strong",
  "--accent", "--accent-fg",
  "--danger", "--danger-fg", "--danger-bg",
  "--ok", "--warn",
  "--grid-header-bg", "--grid-row-alt", "--grid-sel", "--grid-null", "--grid-edited",
  "--syntax-kw", "--syntax-str", "--syntax-num", "--syntax-comment", "--syntax-fn", "--syntax-ident",
] as const;

const isColor = (v: string) => v.startsWith("#") || v.startsWith("color-mix(");

describe("themeData", () => {
  it("ships the built-in palettes with unique ids", () => {
    expect(THEME_SEEDS.length).toBeGreaterThanOrEqual(22);
    expect(new Set(THEME_SEEDS.map((s) => s.id)).size).toBe(THEME_SEEDS.length);
    const ids = THEME_SEEDS.map((s) => s.id);

    for (const id of ["basalt-dark", "basalt-light", "catppuccin", "dracula", "gruvbox", "claude"]) {
      expect(ids).toContain(id);
    }
  });

  it("emits the full token contract for every theme and variant", () => {
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

  it("makes the OLED variant a true-black base for every theme", () => {
    for (const seed of THEME_SEEDS) {
      expect(themeTokens(seed, "amoled")["--bg-0"]).toBe("#000000");
    }
  });

  it("gives each theme a distinct light and dark surface", () => {
    for (const seed of THEME_SEEDS) {
      const light = themeTokens(seed, "light");
      const dark = themeTokens(seed, "dark");
      expect(light["--bg-0"]).not.toBe(dark["--bg-0"]);
    }
  });

  it("maps palettes to their exact seed colours", () => {
    const catppuccin = THEME_SEEDS.find((s) => s.id === "catppuccin")!;
    const darkTokens = themeTokens(catppuccin, "dark");
    expect(darkTokens["--bg-0"]).toBe("#11111b"); // background
    expect(darkTokens["--accent"]).toBe("#cba6f7"); // primary
    expect(darkTokens["--danger"]).toBe("#f38ba8"); // error
    expect(themeTokens(catppuccin, "light")["--bg-0"]).toBe("#eff1f5");

    const dracula = THEME_SEEDS.find((s) => s.id === "dracula")!;
    expect(themeTokens(dracula, "dark")["--accent"]).toBe("#bd93f9");
  });

  it("expands a 4-colour custom theme into the full contract", () => {
    const seed = customSeed("custom-x", "Mine", {
      primary: "#4e8cd9",
      surface: "#141820",
      border: "#2a3240",
      text: "#e6e9ef",
    });
    const tokens = themeTokens(seed, "dark");
    expect(Object.keys(tokens).sort()).toEqual([...CONTRACT].sort());
    expect(tokens["--accent"]).toBe("#4e8cd9");
    expect(themeTokens(seed, "amoled")["--bg-0"]).toBe("#000000");
  });

  it("returns a three-colour swatch per theme", () => {
    for (const seed of THEME_SEEDS) {
      const swatch = themeSwatch(seed);
      expect(swatch).toHaveLength(3);
      for (const c of swatch) expect(c.startsWith("#")).toBe(true);
    }
  });
});
