import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ConnectionProfile } from "$lib/api/types";
import { connections } from "$lib/stores/connections.svelte";
import { toasts } from "$lib/stores/toasts.svelte";
import { panel } from "$lib/stores/panel.svelte";
import SchemaTree from "./SchemaTree.svelte";

const profile: ConnectionProfile = {
  id: "p1",
  name: "warehouse",
  engine: "postgres",
  readOnly: false,
  host: "localhost",
  port: 5432,
  database: "analytics",
};

const tree = {
  namespaces: [{ name: "public", relations: [{ name: "users", kind: "table" as const }] }],
};

function mock(calls: string[]): void {
  let opened = 0;
  mockIPC((cmd, args) => {
    calls.push(cmd);
    if (cmd === "list_connections") return [profile];
    if (cmd === "connect") {
      // The backend resolves the maintenance database when the profile names
      // none; the mock just echoes whichever database the session opened.
      const database = (args as { database?: string })?.database ?? profile.database;
      return {
        sessionId: `s${++opened}`,
        profileId: "p1",
        engine: "postgres",
        readOnly: false,
        database,
      };
    }
    if (cmd === "list_databases") return ["analytics", "billing"];
    if (cmd === "introspect") return tree;
    return undefined;
  });
}

// The store is a module singleton, so a session opened by one case is still open
// in the next one.
beforeEach(async () => {
  for (const t of [...toasts.items]) toasts.dismiss(t.id);
  mockIPC(() => undefined);
  await connections.disconnect(profile.id);
  connections.setActive(null);
  clearMocks();
});

afterEach(clearMocks);

/** Connects the profile the way the Connections panel does, then renders. */
async function renderConnected(calls: string[]): Promise<void> {
  mock(calls);
  await connections.load();
  await connections.connect(profile.id);
  render(SchemaTree);
}

// The panel browses the connection the workspace is pointed at; the connections
// themselves are listed and managed in their own panel.
describe("SchemaTree", () => {
  it("points at the Connections panel when nothing is open", async () => {
    mock([]);
    render(SchemaTree);

    expect(screen.getByText("No connection open.")).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: "Show connections" }));
    expect(panel.active).toBe("connections");
  });

  // A Postgres connection opens onto the server's *databases*, not its schemas: a
  // pg connection is bound to the database it opened, so the schemas under it
  // are only ever one database's worth. The maintenance session discovers them.
  it("lists the server's databases for an open Postgres connection", async () => {
    const calls: string[] = [];
    await renderConnected(calls);

    expect(await screen.findByRole("treeitem", { name: /billing/ })).toBeInTheDocument();
    expect(calls).toContain("list_databases");
    expect(calls).not.toContain("introspect");
  });

  // Expanding a database *opens* it, because there is no other way to read it —
  // the maintenance session cannot see across into it.
  it("opens a database as its own session and introspects that one", async () => {
    const calls: string[] = [];
    await renderConnected(calls);

    await fireEvent.click(await screen.findByRole("treeitem", { name: /billing/ }));

    expect(await screen.findByRole("treeitem", { name: /public/ })).toBeInTheDocument();
    expect(calls.filter((c) => c === "connect")).toHaveLength(2);
    expect(calls).toContain("introspect");
    expect(connections.active?.database).toBe("billing");
  });

  // The profile's own database is already open on the maintenance session, so
  // expanding its row must reuse it rather than pay for a second pool.
  it("reuses the server session for the database the profile already opened", async () => {
    const calls: string[] = [];
    await renderConnected(calls);

    await fireEvent.click(await screen.findByRole("treeitem", { name: /analytics/ }));

    expect(await screen.findByRole("treeitem", { name: /public/ })).toBeInTheDocument();
    expect(calls.filter((c) => c === "connect")).toHaveLength(1);
  });

  // The empty branch used to name privileges as the cause. Three filters can
  // empty that list, and only one of them is a privilege.
  it("claims no cause the database query did not check", async () => {
    mockIPC((cmd, args) => {
      if (cmd === "list_connections") return [profile];
      if (cmd === "connect") {
        return {
          sessionId: "s-empty",
          profileId: "p1",
          engine: "postgres",
          readOnly: false,
          database: (args as { database?: string })?.database ?? profile.database,
        };
      }
      if (cmd === "list_databases") return [];
      return undefined;
    });
    await connections.load();
    await connections.connect(profile.id);
    render(SchemaTree);

    expect(
      await screen.findByText("This server has no database this role can open."),
    ).toBeInTheDocument();
  });
});
