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

  // M3 marks the active tab with a 3px indicator, not a background swap. Asserted
  // structurally so the marker can't quietly regress to colour-only.
  it("draws the indicator under exactly one tab", async () => {
    const view = render(Tabs, { items, activeId: "one", onSelect: vi.fn() });
    const indicators = () => document.querySelectorAll(".bg-primary");

    expect(indicators()).toHaveLength(1);
    expect(screen.getAllByRole("tab")[0].parentElement).toContainElement(
      indicators()[0] as HTMLElement,
    );

    await view.rerender({ items, activeId: "three", onSelect: vi.fn() });
    expect(indicators()).toHaveLength(1);
    expect(screen.getAllByRole("tab")[2].parentElement).toContainElement(
      indicators()[0] as HTMLElement,
    );
  });

  // A failing statement's result tab must stay legible as an error after the tab
  // strip lost its filled active state.
  it("keeps a tab's tone whether or not it is active", async () => {
    const toned: TabItem[] = [
      { id: "ok", label: "Result 1" },
      { id: "bad", label: "Error 2", tone: "danger" },
    ];
    const view = render(Tabs, { items: toned, activeId: "ok", onSelect: vi.fn() });
    expect(screen.getByText("Error 2")).toHaveClass("text-error");

    await view.rerender({ items: toned, activeId: "bad", onSelect: vi.fn() });
    expect(screen.getByText("Error 2")).toHaveClass("text-error");
  });

  it("gives each close action a specific accessible name", async () => {
    const onClose = vi.fn();
    render(Tabs, { items, activeId: "one", onSelect: vi.fn(), onClose });

    await fireEvent.click(screen.getByRole("button", { name: "Close Query 2" }));
    expect(onClose).toHaveBeenCalledWith("two");
  });
});
