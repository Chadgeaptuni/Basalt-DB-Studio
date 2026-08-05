import { describe, it, expect, beforeEach } from "vitest";
import { theme, resolveStoredTheme } from "./theme.svelte";

const root = document.documentElement;
const tok = (name: string) => root.style.getPropertyValue(name);

describe("theme store (DOM application)", () => {
  beforeEach(() => {
    // Clean slate on <html> so each test observes only what it applies. The store
    // is a singleton, so put it back on the default theme too.
    root.removeAttribute("style");
    theme.saveCustomThemes([]);
    theme.set("basalt-dark");
  });

  it("writes the selected appearance's tokens onto <html>", () => {
    theme.set("dracula-dark");
    expect(tok("--primary")).toBe("#bd93f9");
    expect(tok("--error")).toBe("#ff5555");
    expect(root.getAttribute("data-theme")).toBe("dracula-dark");
    expect(root.style.colorScheme).toBe("dark");
  });

  it("uses a true-black base for the OLED preset", () => {
    theme.set("basalt-oled");
    expect(tok("--surface")).toBe("#000000");
    expect(tok("--primary")).toBe("#4e8cd9"); // Basalt dark accent retained
    expect(root.style.colorScheme).toBe("dark");
  });

  it("flags color-scheme:light on a light theme", () => {
    theme.set("basalt-light");
    expect(theme.isLight).toBe(true);
    expect(root.style.colorScheme).toBe("light");
    expect(tok("--surface")).toBe("#ffffff");
  });

  it("toggles between the two appearances of the same family", () => {
    theme.set("catppuccin-dark");
    theme.toggleAppearance();
    expect(theme.current).toBe("catppuccin-light");
    theme.toggleAppearance();
    expect(theme.current).toBe("catppuccin-dark");
  });

  it("toggles a single-appearance theme back to Basalt", () => {
    theme.set("basalt-oled");
    theme.toggleAppearance();
    expect(theme.current).toBe("basalt-light");
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
    expect(theme.category).toBe("dark"); // dark authored surface
  });

  it("migrates a stored theme + variant pair to a single theme id", () => {
    // The two Basalt families merged, so both old ids resolve through one seed.
    expect(resolveStoredTheme("basalt-dark", "light", [])).toBe("basalt-light");
    expect(resolveStoredTheme("basalt-light", "dark", [])).toBe("basalt-dark");
    // Any palette on the OLED variant lands on the one OLED preset.
    expect(resolveStoredTheme("catppuccin", "amoled", [])).toBe("basalt-oled");
    // Ordinary families keep their palette and gain the appearance.
    expect(resolveStoredTheme("catppuccin", "light", [])).toBe("catppuccin-light");
    expect(resolveStoredTheme("gruvbox", "dark", [])).toBe("gruvbox-dark");
    // A retired palette falls back rather than selecting something invalid.
    expect(resolveStoredTheme("removed-theme", "dark", [])).toBe("basalt-dark");
    // Custom themes and already-migrated ids are left alone.
    expect(resolveStoredTheme("custom-9", "dark", ["custom-9"])).toBe("custom-9");
    expect(resolveStoredTheme("tako-light", null, [])).toBe("tako-light");
    expect(resolveStoredTheme("", null, [])).toBe("basalt-dark");
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
