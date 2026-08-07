import { fireEvent, render, screen } from "@testing-library/svelte";
import { beforeEach, describe, expect, it } from "vitest";
import { panel } from "$lib/stores/panel.svelte";
import { settingsDialog } from "$lib/stores/settingsDialog.svelte";
import { DESTINATIONS } from "./destinations";
import NavRail from "./NavRail.svelte";

beforeEach(() => {
  panel.select("schema");
  panel.setCollapsed(false);
});

describe("NavRail", () => {
  it("offers every destination as a tab", () => {
    render(NavRail);
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(DESTINATIONS.length);
    for (const dest of DESTINATIONS) {
      expect(screen.getByRole("tab", { name: dest.label })).toBeInTheDocument();
    }
  });

  it("marks only the showing destination as selected", async () => {
    render(NavRail);
    expect(screen.getByRole("tab", { name: "Schema" })).toHaveAttribute("aria-selected", "true");

    await fireEvent.click(screen.getByRole("tab", { name: "History" }));

    expect(panel.active).toBe("history");
    expect(screen.getByRole("tab", { name: "History" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Schema" })).toHaveAttribute("aria-selected", "false");
  });

  // A collapsed panel means no destination is showing, even though one is still
  // the active choice — otherwise the rail claims to display a hidden panel.
  it("deselects while the panel is collapsed", async () => {
    render(NavRail);
    await fireEvent.click(screen.getByRole("tab", { name: "Schema" }));

    expect(panel.collapsed).toBe(true);
    expect(screen.getByRole("tab", { name: "Schema" })).toHaveAttribute("aria-selected", "false");
  });

  it("moves focus with the arrow keys without selecting", async () => {
    render(NavRail);
    const schema = screen.getByRole("tab", { name: "Schema" });
    schema.focus();

    await fireEvent.keyDown(schema, { key: "ArrowDown" });

    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Queries" }));
    expect(panel.active).toBe("schema"); // focus moved, selection did not
  });

  it("wraps focus at both ends", async () => {
    render(NavRail);
    const schema = screen.getByRole("tab", { name: "Schema" });
    schema.focus();

    await fireEvent.keyDown(schema, { key: "ArrowUp" });
    const last = DESTINATIONS[DESTINATIONS.length - 1].label;
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: last }));
  });

  // Settings opens a dialog instead of selecting a panel, so it must stay out of
  // the tablist: inside it, End and ArrowUp would land on something that is not a
  // destination and screen readers would count it as one.
  it("keeps settings out of the destination tabs", async () => {
    render(NavRail);
    const settings = screen.getByRole("button", { name: "Settings" });

    expect(settings).not.toHaveAttribute("role", "tab");
    expect(screen.getAllByRole("tab")).toHaveLength(DESTINATIONS.length);

    const schema = screen.getByRole("tab", { name: "Schema" });
    schema.focus();
    await fireEvent.keyDown(schema, { key: "End" });

    const last = DESTINATIONS[DESTINATIONS.length - 1].label;
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: last }));
  });

  // The visible label is gone, so `aria-label` is the only name a screen reader
  // has — and the tooltip must not add a wrapper of its own, or each destination
  // becomes a button inside a button and stops being a tab.
  it("names each destination without rendering a visible label", () => {
    render(NavRail);
    const schema = screen.getByRole("tab", { name: "Schema" });

    expect(schema).toHaveAttribute("aria-label", "Schema");
    expect(schema).toHaveTextContent("");
    expect(schema.querySelector("button")).toBeNull();
    expect(schema.closest("button")).toBe(schema);
  });

  it("opens settings on General", async () => {
    render(NavRail);
    expect(settingsDialog.tab).toBeNull();

    await fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(settingsDialog.tab).toBe("general");

    settingsDialog.close();
  });
});
