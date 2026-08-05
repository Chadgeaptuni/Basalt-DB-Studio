import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import Tabs, { type TabItem } from "./Tabs.svelte";

const items: TabItem[] = [
  { id: "one", label: "Query 1", closable: true },
  { id: "two", label: "Query 2", closable: true },
  { id: "three", label: "Query 3" },
];

describe("Tabs", () => {
  it("uses valid tab semantics and supports roving keyboard focus", async () => {
    const onSelect = vi.fn();
    render(Tabs, { items, activeId: "one", onSelect, onClose: vi.fn(), label: "Editor tabs" });

    const tabs = screen.getAllByRole("tab");
    expect(screen.getByRole("tablist", { name: "Editor tabs" })).toBeInTheDocument();
    expect(tabs[0]).toHaveAttribute("tabindex", "0");
    expect(tabs[1]).toHaveAttribute("tabindex", "-1");
    expect(tabs[0].querySelector("button")).toBeNull();

    tabs[0].focus();
    await fireEvent.keyDown(tabs[0], { key: "ArrowRight" });
    expect(tabs[1]).toHaveFocus();
    expect(onSelect).toHaveBeenLastCalledWith("two");

    await fireEvent.keyDown(tabs[1], { key: "End" });
    expect(tabs[2]).toHaveFocus();
    expect(onSelect).toHaveBeenLastCalledWith("three");
  });

  it("gives each close action a specific accessible name", async () => {
    const onClose = vi.fn();
    render(Tabs, { items, activeId: "one", onSelect: vi.fn(), onClose });

    await fireEvent.click(screen.getByRole("button", { name: "Close Query 2" }));
    expect(onClose).toHaveBeenCalledWith("two");
  });
});
