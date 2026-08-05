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
});
