import { render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import CustomThemeEditorModal from "./CustomThemeEditorModal.svelte";
import type { CustomTheme } from "$lib/stores/theme.svelte";
import { DEFAULT_CUSTOM_COLORS, THEME_SEEDS } from "$lib/stores/themeData";

const alternate = THEME_SEEDS.find((seed) => seed.id === "basalt-nord")!.dark;

const first: CustomTheme = {
  id: "custom-first",
  name: "First",
  colors: DEFAULT_CUSTOM_COLORS,
};

const second: CustomTheme = {
  id: "custom-second",
  name: "Second",
  colors: {
    primary: alternate.primary,
    surface: alternate.surface,
    border: alternate.outline,
    text: alternate.onSurface,
  },
};

describe("CustomThemeEditorModal", () => {
  it("resets its editable draft when the selected theme changes", async () => {
    const onclose = vi.fn();
    const onsave = vi.fn();
    const view = render(CustomThemeEditorModal, {
      props: { themeToEdit: first, onclose, onsave },
    });

    expect(screen.getByLabelText("Theme Name")).toHaveValue("First");
    expect(screen.getByLabelText("Primary Accent")).toHaveValue(first.colors.primary);

    await view.rerender({ themeToEdit: second, onclose, onsave });

    expect(screen.getByLabelText("Theme Name")).toHaveValue("Second");
    expect(screen.getByLabelText("Primary Accent")).toHaveValue(second.colors.primary);
  });
});
