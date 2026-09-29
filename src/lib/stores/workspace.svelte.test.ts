import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ConnectionProfile } from "$lib/api/types";
import { editorTabs } from "./tabs.svelte";
import { connections } from "./connections.svelte";
import { restoreWorkspace } from "./workspace.svelte";

const sqlite: ConnectionProfile = { id: "w-lite", name: "lite", engine: "sqlite", readOnly: false, filePath: "/x.db" };
const saved: ConnectionProfile = { id: "w-saved", name: "saved", engine: "postgres", readOnly: false, secretRef: "r" };
const promptOnly: ConnectionProfile = { id: "w-ask", name: "ask", engine: "postgres", readOnly: false };

afterEach(() => {
  clearMocks();
  vi.useRealTimers();
  localStorage.clear();
  for (const t of [...editorTabs.list]) editorTabs.close(t.id);
});

describe("workspace", () => {
  // One test, because restoring also starts the saver — a module-level effect
  // that a second call would double.
  it("restores drafts and quiet connections, then keeps saving", async () => {
    localStorage.setItem(
      "basalt.workspace",
      JSON.stringify({
        tabs: [
          { sql: "select 1", savedPath: null, title: "Query 1" },
          { sql: "select 2", savedPath: "reports/daily", title: "daily" },
        ],
        active: 1,
        connected: [sqlite.id, saved.id, promptOnly.id],
        activeProfile: sqlite.id,
      }),
    );
    const connected: string[] = [];
    mockIPC((cmd, args) => {
      if (cmd === "list_connections") return [sqlite, saved, promptOnly];
      if (cmd === "connect") {
        const profileId = (args as { profileId: string }).profileId;
        connected.push(profileId);
        return { sessionId: `s-${profileId}`, profileId, engine: "sqlite", readOnly: false };
      }
      return undefined;
    });

    await restoreWorkspace();

    expect(editorTabs.list.map((t) => t.sql)).toEqual(["select 1", "select 2"]);
    expect(editorTabs.active?.savedPath).toBe("reports/daily");
    // A connection that would need a password prompt stays closed at launch.
    expect(connected.sort()).toEqual([saved.id, sqlite.id].sort());
    expect(connections.active?.profileId).toBe(sqlite.id);

    vi.useFakeTimers();
    editorTabs.list[0].sql = "select 42";
    await vi.advanceTimersByTimeAsync(600);
    const written = JSON.parse(localStorage.getItem("basalt.workspace") ?? "{}");
    expect(written.tabs[0].sql).toBe("select 42");
  });
});
