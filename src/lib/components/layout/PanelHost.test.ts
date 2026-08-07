import { fireEvent, render, screen } from "@testing-library/svelte";
import { beforeEach, describe, expect, it } from "vitest";
import PanelHost from "./PanelHost.svelte";
import { panel, PANEL_MAX_W, PANEL_MIN_W } from "$lib/stores/panel.svelte";

// The U6 keyboard gate. This handle was pointer-only — the panel could not be
// resized without a mouse, while the SplitPane beside it had full key support.
// Both run on ui/ResizeHandle now, and this pins the half that had none.
describe("PanelHost resize handle", () => {
  beforeEach(() => {
    panel.setWidth(280);
  });

  it("resizes with the keyboard and reports its value", async () => {
    render(PanelHost);
    const separator = screen.getByRole("separator", { name: "Resize panel" });

    expect(separator).toHaveAttribute("aria-orientation", "vertical");
    expect(separator).toHaveAttribute("aria-valuenow", "280");

    await fireEvent.keyDown(separator, { key: "ArrowRight" });
    expect(panel.width).toBe(296);

    await fireEvent.keyDown(separator, { key: "ArrowLeft" });
    expect(panel.width).toBe(280);
  });

  it("clamps at both ends rather than running past them", async () => {
    render(PanelHost);
    const separator = screen.getByRole("separator", { name: "Resize panel" });

    await fireEvent.keyDown(separator, { key: "Home" });
    expect(panel.width).toBe(PANEL_MIN_W);

    await fireEvent.keyDown(separator, { key: "End" });
    expect(panel.width).toBe(PANEL_MAX_W);
  });

  it("ignores keys it doesn't own, so they reach the app's shortcuts", async () => {
    render(PanelHost);
    const separator = screen.getByRole("separator", { name: "Resize panel" });

    const event = new KeyboardEvent("keydown", { key: "b", cancelable: true, bubbles: true });
    separator.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(panel.width).toBe(280);
  });
});
