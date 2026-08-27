import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import ListItem from "./ListItem.svelte";

// A row inside a divided or bordered list has its edges drawn by the container,
// so the inset pill left a gap between the hover and the divider above it and
// read as a hover that missed its row. `flush` is that case: the wash fills the
// row, and the selected fill moves to the container so hovering a selected row
// does not replace its tonal background with the 8% wash.
describe("ListItem", () => {
  it("draws the inset pill by default", () => {
    render(ListItem, { headline: "warehouse" });
    const cls = screen.getByRole("button", { name: "warehouse" }).className;

    expect(cls).toContain("before:inset-x-1");
    expect(cls).not.toContain("hover:bg-on-surface/8");
  });

  it("fills the row when flush", () => {
    render(ListItem, { headline: "warehouse", flush: true });
    const cls = screen.getByRole("button", { name: "warehouse" }).className;

    expect(cls).toContain("hover:bg-on-surface/8");
    expect(cls).not.toContain("before:inset-x-1");
  });

  it("puts a flush row's selected fill behind the wash, on the container", () => {
    render(ListItem, { headline: "warehouse", flush: true, selected: true });
    const button = screen.getByRole("button", { name: "warehouse" });

    expect(button.className).not.toContain("bg-secondary-container");
    expect(button.parentElement?.className).toContain("bg-secondary-container");
    expect(button.querySelector("span[aria-hidden]")).toBeNull();
  });
});
