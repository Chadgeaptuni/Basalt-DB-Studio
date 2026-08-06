import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import X from "@lucide/svelte/icons/x";
import IconButton from "./IconButton.svelte";

describe("IconButton", () => {
  it("only exposes pressed state for toggle buttons", () => {
    const view = render(IconButton, { icon: X, title: "Close" });
    expect(screen.getByRole("button", { name: "Close" })).not.toHaveAttribute("aria-pressed");

    view.unmount();
    render(IconButton, { icon: X, title: "History", active: false });
    expect(screen.getByRole("button", { name: "History" })).toHaveAttribute("aria-pressed", "false");
  });

  // Regression: the title moved from a native `title` attribute to a `Tooltip`.
  // The accessible name must not have moved with it — a screen reader has to name
  // the control whether or not the tooltip is mounted.
  it("names the control without relying on the tooltip", () => {
    render(IconButton, { icon: X, title: "Close" });
    const button = screen.getByRole("button", { name: "Close" });
    expect(button).toHaveAttribute("aria-label", "Close");
    expect(button).not.toHaveAttribute("title");
  });
});
