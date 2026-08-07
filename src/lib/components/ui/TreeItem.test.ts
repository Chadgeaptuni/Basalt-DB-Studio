import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import TreeItem from "./TreeItem.svelte";

describe("TreeItem", () => {
  it("activates on Enter and Space", async () => {
    const onclick = vi.fn();
    render(TreeItem, { label: "users", onclick });
    const row = screen.getByRole("treeitem", { name: "users" });

    await fireEvent.keyDown(row, { key: "Enter" });
    await fireEvent.keyDown(row, { key: " " });
    expect(onclick).toHaveBeenCalledTimes(2);
  });

  // The row announces `aria-expanded`, so the arrow keys that go with the ARIA
  // tree pattern have to work — and they are directional, not a toggle: → on an
  // already-open node must leave it open.
  it("expands with ArrowRight and collapses with ArrowLeft, directionally", async () => {
    const ontoggle = vi.fn();
    const { rerender } = render(TreeItem, {
      label: "public",
      expandable: true,
      expanded: false,
      ontoggle,
    });
    const row = screen.getByRole("treeitem", { name: "public" });

    await fireEvent.keyDown(row, { key: "ArrowLeft" });
    expect(ontoggle, "collapsing an already-collapsed node is a no-op").not.toHaveBeenCalled();

    await fireEvent.keyDown(row, { key: "ArrowRight" });
    expect(ontoggle).toHaveBeenCalledTimes(1);

    await rerender({ label: "public", expandable: true, expanded: true, ontoggle });
    await fireEvent.keyDown(row, { key: "ArrowRight" });
    expect(ontoggle, "expanding an open node is a no-op").toHaveBeenCalledTimes(1);

    await fireEvent.keyDown(row, { key: "ArrowLeft" });
    expect(ontoggle).toHaveBeenCalledTimes(2);
  });

  it("leaves arrows alone on a leaf row", async () => {
    const ontoggle = vi.fn();
    render(TreeItem, { label: "id", ontoggle });
    const row = screen.getByRole("treeitem", { name: "id" });

    await fireEvent.keyDown(row, { key: "ArrowRight" });
    expect(ontoggle).not.toHaveBeenCalled();
  });
});
