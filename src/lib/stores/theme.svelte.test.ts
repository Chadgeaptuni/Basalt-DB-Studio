import { describe, it, expect, beforeEach } from "vitest";
import { theme } from "./theme.svelte";

const root = document.documentElement;
const tok = (name: string) => root.style.getPropertyValue(name);

describe("theme store (DOM application)", () => {
  beforeEach(() => {
    // Clean slate on <html> so each test observes only what it applies. The
    // store is a singleton, so reset the variant too (a prior test may have
    // left it on "light").
    root.removeAttribute("style");
    theme.saveCustomThemes([]);
    theme.setVariant("dark");
  });

  it("writes a preset's per-variant tokens onto <html>", () => {
    theme.set("dracula");
    theme.setVariant("dark");
    expect(tok("--accent")).toBe("#bd93f9");
    expect(tok("--danger")).toBe("#ff5555");
    expect(root.getAttribute("data-theme")).toBe("dracula");
    expect(root.getAttribute("data-variant")).toBe("dark");
    expect(root.style.colorScheme).toBe("dark");
  });

  it("switches to a true-black base on the OLED variant", () => {
    theme.set("catppuccin");
    theme.setVariant("amoled");
    expect(tok("--bg-0")).toBe("#000000");
    expect(tok("--accent")).toBe("#cba6f7"); // dark accent retained
    expect(root.getAttribute("data-variant")).toBe("amoled");
  });

  it("flags color-scheme:light on the light variant", () => {
    theme.set("basalt-light");
    theme.setVariant("light");
    expect(root.style.colorScheme).toBe("light");
    expect(tok("--bg-0")).toBe("#ffffff");
  });

  it("applies a custom theme's accent and reaches the whole contract", () => {
    theme.saveCustomThemes([
      { id: "custom-1", name: "Mine", colors: { primary: "#ff8800", surface: "#101418", border: "#2a2f36", text: "#eef2f6" } },
    ]);
    theme.set("custom-1");
    expect(tok("--accent")).toBe("#ff8800");
    expect(tok("--fg-0")).toBe("#eef2f6");
    expect(tok("--bg-2")).toBe("#101418");
    expect(root.getAttribute("data-theme")).toBe("custom-1");
  });

  it("falls back to the default when the active custom theme is deleted", () => {
    theme.saveCustomThemes([
      { id: "custom-2", name: "Temp", colors: { primary: "#22aa88", surface: "#0e1014", border: "#242830", text: "#e8ecf0" } },
    ]);
    theme.set("custom-2");
    theme.deleteCustomTheme("custom-2");
    expect(theme.current).toBe("basalt-dark");
    expect(tok("--accent")).toBe("#4e8cd9"); // basalt-dark dark primary
  });
});
