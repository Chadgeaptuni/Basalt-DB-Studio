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
});
