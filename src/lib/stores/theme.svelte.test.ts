import { describe, it, expect, beforeEach } from "vitest";
import { theme, resolveStoredSelection } from "./theme.svelte";

const root = document.documentElement;
const tok = (name: string) => root.style.getPropertyValue(name);

describe("theme store (DOM application)", () => {
  beforeEach(() => {
    // Clean slate on <html> so each test observes only what it applies. The store
    // is a singleton, so put it back on the default theme too.
    root.removeAttribute("style");
    theme.saveCustomThemes([]);
    theme.set("basalt-dark");
    theme.setVariant("dark");
  });

  it("writes the selected palette's tokens onto <html>", () => {
    theme.set("dracula");
    expect(tok("--primary")).toBe("#bd93f9");
    expect(tok("--error")).toBe("#ff5555");
    expect(root.getAttribute("data-theme")).toBe("dracula");
    expect(root.getAttribute("data-variant")).toBe("dark");
    expect(root.style.colorScheme).toBe("dark");
  });

  it("re-renders the same palette when the variant changes", () => {
    theme.set("catppuccin");
    theme.setVariant("light");
    expect(tok("--surface")).toBe("#eff1f5");
    expect(root.style.colorScheme).toBe("light");

    theme.setVariant("dark");
    expect(tok("--surface")).toBe("#11111b");
    expect(root.style.colorScheme).toBe("dark");
  });

  it("uses a true-black base on the AMOLED variant", () => {
    theme.setVariant("amoled");
    expect(tok("--surface")).toBe("#000000");
    expect(tok("--primary")).toBe("#4e8cd9"); // Basalt dark accent retained
    expect(root.style.colorScheme).toBe("dark");
  });

  it("toggles the variant between light and dark", () => {
    theme.toggleAppearance();
    expect(theme.variant).toBe("light");
    expect(theme.isLight).toBe(true);
    theme.toggleAppearance();
    expect(theme.variant).toBe("dark");
  });

  it("toggles out of AMOLED into light", () => {
    theme.setVariant("amoled");
    theme.toggleAppearance();
    expect(theme.variant).toBe("light");
  });

  // Regression: TopBar wires `onclick={theme.toggleAppearance}`, which detaches
  // the receiver — the method threw "this.setVariant is not a function" at runtime
  // while every call-with-receiver test stayed green.
  it("toggles when the method is detached from the store", () => {
    const detached = theme.toggleAppearance;
    expect(() => detached()).not.toThrow();
    expect(theme.variant).toBe("light");
  });

  it("deletes a custom theme when the method is detached", () => {
    theme.saveCustomThemes([
      { id: "custom-del", name: "Gone", colors: { primary: "#ff8800", surface: "#101418", border: "#2a2f36", text: "#eef2f6" } },
    ]);
    theme.set("custom-del");
    const detached = theme.deleteCustomTheme;
    expect(() => detached("custom-del")).not.toThrow();
    expect(theme.current).toBe("basalt-dark");
    expect(theme.customThemes).toHaveLength(0);
  });

  it("applies a custom theme's accent and reaches the whole contract", () => {
    theme.saveCustomThemes([
      { id: "custom-1", name: "Mine", colors: { primary: "#ff8800", surface: "#101418", border: "#2a2f36", text: "#eef2f6" } },
    ]);
    theme.set("custom-1");
    expect(tok("--primary")).toBe("#ff8800");
    expect(tok("--on-surface")).toBe("#eef2f6");
    expect(tok("--surface-container-high")).toBe("#101418");
    expect(root.getAttribute("data-theme")).toBe("custom-1");
  });

  it("renders a custom theme as authored regardless of the variant", () => {
    theme.saveCustomThemes([
      { id: "custom-lt", name: "Paperish", colors: { primary: "#2f6fd0", surface: "#f4f5f7", border: "#d5d8de", text: "#151515" } },
    ]);
    theme.set("custom-lt");

    // The light variant must not invert an already-light custom palette…
    theme.setVariant("light");
    expect(tok("--surface-container-high")).toBe("#f4f5f7");
    expect(root.style.colorScheme).toBe("light");
    // …nor must the dark variant darken it.
    theme.setVariant("dark");
    expect(tok("--surface-container-high")).toBe("#f4f5f7");
    expect(root.style.colorScheme).toBe("light");
    // AMOLED is the one modifier that still applies.
    theme.setVariant("amoled");
    expect(tok("--surface")).toBe("#000000");
  });

  it("unfolds a stored flat-theme id back into a theme + variant pair", () => {
    // Ids the variant-less build wrote: the appearance was baked into the id.
    expect(resolveStoredSelection("catppuccin-light", null, [])).toEqual({
      theme: "catppuccin",
      variant: "light",
    });
    expect(resolveStoredSelection("gruvbox-dark", null, [])).toEqual({
      theme: "gruvbox",
      variant: "dark",
    });
    // The two Basalt seeds end in -light/-dark themselves, so they must survive
    // whole rather than being split into a non-existent "basalt" palette.
    expect(resolveStoredSelection("basalt-light", null, [])).toEqual({
      theme: "basalt-light",
      variant: "light",
    });
    expect(resolveStoredSelection("basalt-dark", null, [])).toEqual({
      theme: "basalt-dark",
      variant: "dark",
    });
    // Multi-segment palette ids unfold on the trailing appearance only.
    expect(resolveStoredSelection("basalt-nord-light", null, [])).toEqual({
      theme: "basalt-nord",
      variant: "light",
    });
    // The OLED entry was a theme of its own; it becomes the AMOLED variant.
    expect(resolveStoredSelection("basalt-oled", null, [])).toEqual({
      theme: "basalt-dark",
      variant: "amoled",
    });
  });

  it("keeps a selection that is already a theme + variant pair", () => {
    expect(resolveStoredSelection("catppuccin", "amoled", [])).toEqual({
      theme: "catppuccin",
      variant: "amoled",
    });
    expect(resolveStoredSelection("custom-9", "light", ["custom-9"])).toEqual({
      theme: "custom-9",
      variant: "light",
    });
    // A retired palette falls back rather than selecting something invalid.
    expect(resolveStoredSelection("removed-theme", "dark", [])).toEqual({
      theme: "basalt-dark",
      variant: "dark",
    });
    expect(resolveStoredSelection("", null, [])).toEqual({ theme: "basalt-dark", variant: "dark" });
  });

  it("falls back to the default when the active custom theme is deleted", () => {
    theme.saveCustomThemes([
      { id: "custom-2", name: "Temp", colors: { primary: "#22aa88", surface: "#0e1014", border: "#242830", text: "#e8ecf0" } },
    ]);
    theme.set("custom-2");
    theme.deleteCustomTheme("custom-2");
    expect(theme.current).toBe("basalt-dark");
    expect(tok("--primary")).toBe("#4e8cd9"); // Basalt dark primary
  });
});
