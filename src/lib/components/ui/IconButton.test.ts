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
});
