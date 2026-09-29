import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { afterEach, describe, expect, it } from "vitest";
import { editorTabs } from "./tabs.svelte";
import { savedQueries } from "./savedQueries.svelte";

afterEach(() => {
  clearMocks();
  for (const t of [...editorTabs.list]) editorTabs.close(t.id);
});

describe("savedQueries", () => {
  // Ctrl+S on a tab bound to the old path would otherwise recreate the query
  // there, next to the one just moved.
  it("rebinds open tabs when a query is renamed or moved", async () => {
    const calls: unknown[] = [];
    mockIPC((cmd, args) => {
      if (cmd === "rename_saved_query") calls.push(args);
      if (cmd === "list_saved_queries") return [{ path: "reports/daily", name: "daily" }];
      return undefined;
    });
    const id = editorTabs.openSaved("daily", "daily", "select 1");

    await savedQueries.rename("daily", "reports/daily");

    expect(calls).toEqual([{ from: "daily", to: "reports/daily" }]);
    expect(editorTabs.find(id)).toMatchObject({ savedPath: "reports/daily", title: "daily" });
    expect(savedQueries.items.map((q) => q.path)).toEqual(["reports/daily"]);
  });
});
