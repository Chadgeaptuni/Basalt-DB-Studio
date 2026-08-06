import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import ResultsPane from "./ResultsPane.svelte";
import { connections } from "$lib/stores/connections.svelte";
import { editorTabs } from "$lib/stores/tabs.svelte";

const session = { sessionId: "s1", profileId: "p1", engine: "postgres" as const, readOnly: false };

afterEach(() => {
  clearMocks();
  for (const t of [...editorTabs.list]) editorTabs.close(t.id);
});

describe("ResultsPane", () => {
  // Regression: export used to re-run the live editor draft, so editing after a
  // run exported a different query than the rows on screen.
  it("exports the SQL that produced the shown result, not the edited draft", async () => {
    let exported: string | undefined;
    mockIPC((cmd, args) => {
      if (cmd === "plugin:dialog|save") return "/tmp/out.csv";
      if (cmd === "export_query") {
        exported = (args as { sql: string }).sql;
        return 3;
      }
      return undefined;
    });
    connections.setActive(session);

    const id = editorTabs.open("SELECT 1");
    const tab = editorTabs.find(id)!;
    tab.lastRunSql = "SELECT 1";
    tab.sql = "DROP TABLE users"; // draft moved on after the run

    render(ResultsPane, {});
    await fireEvent.click(screen.getByRole("button", { name: "Export query result" }));
    await Promise.resolve();

    expect(exported).toBe("SELECT 1");
  });

  it("disables export before the first run", () => {
    connections.setActive(session);
    editorTabs.open("SELECT 1");

    render(ResultsPane, {});

    expect(screen.getByRole("button", { name: "Export query result" })).toBeDisabled();
  });
});
