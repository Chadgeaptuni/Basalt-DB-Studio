import { describe, it, expect, beforeEach } from "vitest";
import { sidebar, SECTIONS } from "./sidebar.svelte";

// Normalize to "all sections open" so weight/collapse assertions are order-independent.
function reset(): void {
  for (const s of SECTIONS) if (sidebar.isCollapsed(s.id)) sidebar.toggle(s.id);
  sidebar.setAutoHidden([]);
  sidebar.setAvailH(1000);
}

describe("sidebar store", () => {
  beforeEach(reset);

  it("clamps width to the allowed range", () => {
    sidebar.setWidth(50);
    expect(sidebar.width).toBe(180);
    sidebar.setWidth(9999);
    expect(sidebar.width).toBe(600);
  });

  it("toggle collapses and re-expands a section", () => {
    expect(sidebar.isOpen("schema")).toBe(true);
    sidebar.toggle("schema");
    expect(sidebar.isCollapsed("schema")).toBe(true);
    expect(sidebar.isOpen("schema")).toBe(false);
    sidebar.toggle("schema");
    expect(sidebar.isOpen("schema")).toBe(true);
  });

  it("auto-hidden sections are not open even when not manually collapsed", () => {
    sidebar.setAutoHidden(["saved"]);
    expect(sidebar.isCollapsed("saved")).toBe(false);
    expect(sidebar.isOpen("saved")).toBe(false);
  });

  it("resize transfers weight from below to above, conserving the pair's total", () => {
    const before = sidebar.size("connections") + sidebar.size("schema");
    sidebar.resizeSections("connections", "schema", 40); // drag divider down
    expect(sidebar.size("connections")).toBeGreaterThan(sidebar.size("schema"));
    expect(sidebar.size("connections") + sidebar.size("schema")).toBeCloseTo(before, 6);
  });

  it("resize refuses to shrink a section past the MIN_BODY floor", () => {
    const a = sidebar.size("connections");
    const b = sidebar.size("schema");
    sidebar.resizeSections("connections", "schema", 1e6); // absurd drag
    expect(sidebar.size("connections")).toBe(a);
    expect(sidebar.size("schema")).toBe(b);
  });
});
