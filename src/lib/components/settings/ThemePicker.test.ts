import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import { dialogs } from "$lib/stores/dialogs.svelte";
import { theme, type CustomTheme } from "$lib/stores/theme.svelte";
import { DEFAULT_CUSTOM_COLORS } from "$lib/stores/themeData";
import ThemePicker from "./ThemePicker.svelte";

const custom: CustomTheme = {
  id: "custom-audit",
  name: "Audit theme",
  colors: { ...DEFAULT_CUSTOM_COLORS },
};

afterEach(() => {
  dialogs.cancel();
  theme.saveCustomThemes([]);
  theme.set("basalt-dark");
});

describe("ThemePicker", () => {
  it("groups every theme under exactly one appearance section", () => {
    render(ThemePicker);

    for (const title of ["Light", "Dark", "OLED"]) {
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    }
    // One row per theme id, and each id appears once across all sections.
    const names = screen.getAllByRole("button").map((b) => b.textContent?.trim());
    const themeRows = names.filter((n) => n?.startsWith("Catppuccin"));
    expect(themeRows).toHaveLength(2); // Catppuccin Light + Catppuccin Dark
    expect(screen.getAllByRole("button", { name: /^Basalt OLED/ })).toHaveLength(1);
  });

  it("selects the appearance the row advertises", async () => {
    render(ThemePicker);

    await fireEvent.click(screen.getByRole("button", { name: /^Catppuccin Light/ }));

    expect(theme.current).toBe("catppuccin-light");
    expect(theme.isLight).toBe(true);
  });

  it("files a custom theme by its authored surface", () => {
    const lightCustom: CustomTheme = {
      id: "custom-light",
      name: "Paperish",
      colors: { ...DEFAULT_CUSTOM_COLORS, surface: "#f4f5f7", text: "#151515" },
    };
    theme.saveCustomThemes([custom, lightCustom]);
    render(ThemePicker);

    const sections = screen.getAllByRole("heading").map((h) => h.textContent);
    expect(sections).toEqual(["Light", "Dark", "OLED"]);
    // Dark-surfaced custom sits with Dark, light-surfaced one with Light.
    const lightSection = screen.getByRole("heading", { name: "Light" }).parentElement!;
    const darkSection = screen.getByRole("heading", { name: "Dark" }).parentElement!;
    expect(lightSection.textContent).toContain("Paperish");
    expect(darkSection.textContent).toContain("Audit theme");
  });

  it("confirms before deleting a custom theme", async () => {
    theme.saveCustomThemes([custom]);
    render(ThemePicker);

    await fireEvent.click(screen.getByRole("button", { name: "Delete Audit theme" }));
    expect(dialogs.active?.title).toBe("Delete custom theme “Audit theme”?");
    expect(theme.customThemes).toHaveLength(1);

    dialogs.accept();
    await waitFor(() => expect(theme.customThemes).toHaveLength(0));
  });
});
