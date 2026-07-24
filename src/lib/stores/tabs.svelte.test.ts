import { describe, it, expect, beforeEach } from "vitest";
import { editorTabs } from "./tabs.svelte";

function reset(): void {
  for (const t of [...editorTabs.list]) editorTabs.close(t.id);
}

describe("editorTabs", () => {
  beforeEach(reset);

  it("opens a tab, makes it active, and seeds it with sql", () => {
    const id = editorTabs.open("SELECT 1");
    expect(editorTabs.active?.id).toBe(id);
    expect(editorTabs.active?.sql).toBe("SELECT 1");
    expect(editorTabs.list).toHaveLength(1);
  });

  it("activates a neighbour when the active tab closes", () => {
    const a = editorTabs.open("a");
    const b = editorTabs.open("b");
    expect(editorTabs.active?.id).toBe(b);
    editorTabs.close(b);
    expect(editorTabs.active?.id).toBe(a);
  });

  it("goes empty when the last tab closes", () => {
    const a = editorTabs.open();
    editorTabs.close(a);
    expect(editorTabs.list).toHaveLength(0);
    expect(editorTabs.active).toBeNull();
  });
});
