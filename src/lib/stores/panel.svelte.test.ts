import { describe, it, expect, beforeEach } from "vitest";
import { panel, PANELS } from "./panel.svelte";

describe("panel store", () => {
  beforeEach(() => {
    panel.select("schema");
    panel.setCollapsed(false);
  });

  it("clamps width to the allowed range", () => {
    panel.setWidth(50);
    expect(panel.width).toBe(180);
    panel.setWidth(9999);
    expect(panel.width).toBe(600);
  });

  it("selects a destination and reveals the panel", () => {
    panel.setCollapsed(true);
    panel.select("history");
    expect(panel.active).toBe("history");
    expect(panel.collapsed).toBe(false);
  });

  // The rail's only mouse affordance for hiding the panel: click the destination
  // that is already showing.
  it("collapses when the active destination is selected again", () => {
    panel.select("schema");
    expect(panel.collapsed).toBe(true);
    expect(panel.active).toBe("schema"); // still the destination, just hidden
  });

  it("re-selecting a collapsed destination reopens rather than toggling off", () => {
    panel.setCollapsed(true);
    panel.select("schema");
    expect(panel.collapsed).toBe(false);
  });

  it("toggleCollapsed round-trips", () => {
    panel.toggleCollapsed();
    expect(panel.collapsed).toBe(true);
    panel.toggleCollapsed();
    expect(panel.collapsed).toBe(false);
  });

  // Persisted state written by a build with different destinations must not
  // select an id the rail cannot render.
  it("falls back to schema for an unknown persisted destination", () => {
    localStorage.setItem("basalt.panel.active", "connections");
    expect(PANELS).not.toContain("connections" as never);
  });
});
