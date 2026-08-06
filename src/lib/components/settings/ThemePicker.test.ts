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
  theme.setVariant("dark");
});

describe("ThemePicker", () => {
  it("offers every variant alongside one row per palette", () => {
    render(ThemePicker);

    // Rendered lowercase and uppercased in CSS, so the accessible name is the raw word.
    for (const label of ["light", "dark", "OLED"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
    // A palette is one row — the appearance is the separate variant choice.
    expect(screen.getAllByRole("button", { name: /^Catppuccin/ })).toHaveLength(1);
  });

  it("switches the variant without changing the palette", async () => {
    render(ThemePicker);
    theme.set("catppuccin");

    await fireEvent.click(screen.getByRole("button", { name: "light" }));

    expect(theme.variant).toBe("light");
    expect(theme.current).toBe("catppuccin");
  });

  it("selects the palette the row advertises", async () => {
    render(ThemePicker);

    await fireEvent.click(screen.getByRole("button", { name: /^Catppuccin/ }));

    expect(theme.current).toBe("catppuccin");
  });

  it("lists custom themes above the presets", () => {
    theme.saveCustomThemes([custom]);
    render(ThemePicker);

    expect(screen.getByText("Custom Themes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Audit theme/ })).toBeInTheDocument();
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
