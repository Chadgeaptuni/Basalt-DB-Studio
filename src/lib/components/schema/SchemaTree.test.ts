import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ConnectionProfile } from "$lib/api/types";
import { connections } from "$lib/stores/connections.svelte";
import { toasts } from "$lib/stores/toasts.svelte";
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
// in the next one — and a root that is already connected does not connect again.
beforeEach(async () => {
  for (const t of [...toasts.items]) toasts.dismiss(t.id);
  mockIPC(() => undefined);
  await connections.disconnect(profile.id);
  clearMocks();
});

afterEach(clearMocks);

// The panel is the connection list *and* the schema browser — pgAdmin's shape.
// Every saved profile is a root whether or not it holds a session, and expanding
// one is what connects it; there is no other connection surface to fall back on.
describe("SchemaTree", () => {
  it("roots the tree at every saved connection, connected or not", async () => {
    mock([]);
    render(SchemaTree);

    const root = await screen.findByRole("treeitem", { name: /warehouse/ });
    expect(root).toHaveAttribute("aria-expanded", "false");
  });

  // A Postgres root opens onto the server's *databases*, not its schemas: a pg
  // connection is bound to the database it opened, so the schemas under it are
  // only ever one database's worth. The maintenance session discovers the list.
  it("lists the server's databases when a Postgres root is expanded", async () => {
    const calls: string[] = [];
    mock(calls);
    render(SchemaTree);

    await fireEvent.click(await screen.findByRole("treeitem", { name: /warehouse/ }));

    expect(await screen.findByRole("treeitem", { name: /billing/ })).toBeInTheDocument();
    expect(calls).toContain("connect");
    expect(calls).toContain("list_databases");
    expect(calls).not.toContain("introspect");
  });

  // Expanding a database *opens* it, because there is no other way to read it —
  // the maintenance session cannot see across into it.
  it("opens a database as its own session and introspects that one", async () => {
    const calls: string[] = [];
    mock(calls);
    render(SchemaTree);

    await fireEvent.click(await screen.findByRole("treeitem", { name: /warehouse/ }));
    await fireEvent.click(await screen.findByRole("treeitem", { name: /billing/ }));

    expect(await screen.findByRole("treeitem", { name: /public/ })).toBeInTheDocument();
    expect(calls.filter((c) => c === "connect")).toHaveLength(2);
    expect(calls).toContain("introspect");
  });

  // The profile's own database is already open on the maintenance session, so
  // expanding its row must reuse it rather than pay for a second pool.
  it("reuses the server session for the database the profile already opened", async () => {
    const calls: string[] = [];
    mock(calls);
    render(SchemaTree);

    await fireEvent.click(await screen.findByRole("treeitem", { name: /warehouse/ }));
    await fireEvent.click(await screen.findByRole("treeitem", { name: /analytics/ }));

    expect(await screen.findByRole("treeitem", { name: /public/ })).toBeInTheDocument();
    expect(calls.filter((c) => c === "connect")).toHaveLength(1);
  });

  // Every grid commit and editor run resolves the *active* session at execute
  // time. A click on a connected root re-pointed it at the root's own session —
  // for Postgres, the maintenance database — so collapsing the tree could send a
  // staged UPDATE to a different database than the one it was staged against.
  it("leaves the workspace pointed at the database when the root is clicked", async () => {
    mock([]);
    render(SchemaTree);

    await fireEvent.click(await screen.findByRole("treeitem", { name: /warehouse/ }));
    await fireEvent.click(await screen.findByRole("treeitem", { name: /billing/ }));
    await waitFor(() => expect(connections.active?.database).toBe("billing"));

    // Collapse the root. The maintenance session is `analytics` here, so a
    // re-pointed workspace is visible in the active session's database.
    await fireEvent.click(screen.getByRole("treeitem", { name: /warehouse/ }));

    expect(connections.active?.database).toBe("billing");
  });

  it("offers the connection form when there are none saved", async () => {
    mockIPC((cmd) => (cmd === "list_connections" ? [] : undefined));
    render(SchemaTree);

    expect(await screen.findByText("No connections yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New connection" })).toBeInTheDocument();
  });

  // The error used to be pinned under the root it came from, where you have to go
  // back and find it. It is a toast now — one announcement, wherever the connect
  // was triggered from — and the root closes rather than sitting open and empty.
  it("announces a failed connect as a toast, not a row under the root", async () => {
    mockIPC((cmd) => {
      if (cmd === "list_connections") return [profile];
      if (cmd === "connect") throw { kind: "authFailed", message: "password authentication failed" };
      return undefined;
    });
    render(SchemaTree);
    const root = await screen.findByRole("treeitem", { name: /warehouse/ });

    await fireEvent.click(root);

    await waitFor(() =>
      expect(toasts.items.at(-1)?.message).toBe("Connect to “warehouse”: Authentication failed"),
    );
    expect(screen.queryByText("password authentication failed")).not.toBeInTheDocument();
    // Eventual, not immediate: the toast is raised inside the connect and the
    // re-collapse is one await further on, when the failed open returns.
    await waitFor(() => expect(root).toHaveAttribute("aria-expanded", "false"));
  });
});
