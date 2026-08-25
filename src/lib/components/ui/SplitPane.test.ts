import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import SplitPaneTestHarness from "./SplitPane.test-harness.svelte";

describe("SplitPane", () => {
  it("exposes its value and supports keyboard resizing within the pane minimum", async () => {
    render(SplitPaneTestHarness);
    const separator = screen.getByRole("separator", { name: "Resize editor and results" });
    const container = separator.parentElement!;
    container.getBoundingClientRect = () =>
      ({ width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600, x: 0, y: 0, toJSON() {} }) as DOMRect;

    expect(separator).toHaveAttribute("aria-orientation", "horizontal");
    expect(separator).toHaveAttribute("aria-valuenow", "50");

    await fireEvent.keyDown(separator, { key: "ArrowUp" });
    expect(separator).toHaveAttribute("aria-valuenow", "48");

    await fireEvent.keyDown(separator, { key: "Home" });
    expect(separator).toHaveAttribute("aria-valuenow", "20");

    await fireEvent.keyDown(separator, { key: "End" });
    expect(separator).toHaveAttribute("aria-valuenow", "80");
  });

  // Regression: the appearance used to live on each caller, and the two drifted —
  // SplitPane signalled with full `--primary`, PanelHost with `--primary/40`, so
  // the same gesture gave different feedback per pane. ResizeHandle owns it now,
  // which is only observable as the classes it puts on the separator itself.
  it("takes its hairline and accent from ResizeHandle, and holds the accent while dragging", async () => {
    render(SplitPaneTestHarness);
    const separator = screen.getByRole("separator", { name: "Resize editor and results" });

    expect(separator).toHaveClass("bg-outline-variant", "hover:bg-primary");
    expect(separator.className).not.toMatch(/primary\/\d/);

    // jsdom implements neither half of the pointer-capture API.
    separator.setPointerCapture = () => {};
    separator.releasePointerCapture = () => {};

    await fireEvent.pointerDown(separator, { pointerId: 1 });
    expect(separator).toHaveClass("bg-primary");
    expect(separator).not.toHaveClass("bg-outline-variant");

    await fireEvent.pointerUp(separator, { pointerId: 1 });
    expect(separator).toHaveClass("bg-outline-variant");
  });
});
