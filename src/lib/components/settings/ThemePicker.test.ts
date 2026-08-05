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
