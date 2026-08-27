import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import ContextMenuTestHarness from "./ContextMenu.test-harness.svelte";

describe("ContextMenu", () => {
  it("supports arrow-key navigation and selection", async () => {
    const onselect = vi.fn();
    render(ContextMenuTestHarness, { props: { onselect } });

    await fireEvent.contextMenu(screen.getByRole("button", { name: "Query row" }), {
      clientX: 80,
      clientY: 60,
    });

    const menu = await screen.findByRole("menu");
    await fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(screen.getByRole("menuitem", { name: "Open" })).toHaveFocus();

    await fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    expect(screen.getByRole("menuitem", { name: "Delete" })).toHaveFocus();

    await fireEvent.keyDown(document.activeElement!, { key: "Enter" });
    expect(onselect).toHaveBeenCalledWith("Delete");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });

  // Sections exist so a menu that mixes what an object does with what happens to
  // it does not read as one list — and so the destructive row is never the
  // neighbour of a harmless one. Flat arrays keep working: same rows, no rule.
  it("separates sections without changing how the rows behave", async () => {
    const onselect = vi.fn();
    render(ContextMenuTestHarness, { props: { onselect, grouped: true } });

    await fireEvent.contextMenu(screen.getByRole("button", { name: "Query row" }), {
      clientX: 80,
      clientY: 60,
    });

    const menu = await screen.findByRole("menu");
    expect(menu.querySelectorAll('[role="separator"]')).toHaveLength(1);
    expect(screen.getAllByRole("menuitem")).toHaveLength(2);

    await fireEvent.keyDown(menu, { key: "ArrowDown" });
    await fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    expect(screen.getByRole("menuitem", { name: "Delete" })).toHaveFocus();
  });
});
