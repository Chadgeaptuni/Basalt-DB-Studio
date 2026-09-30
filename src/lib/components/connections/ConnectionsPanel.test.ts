import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ConnectionProfile } from "$lib/api/types";
import { connections } from "$lib/stores/connections.svelte";
import { toasts } from "$lib/stores/toasts.svelte";
import ConnectionsPanel from "./ConnectionsPanel.svelte";

const sqlite: ConnectionProfile = {
  id: "p1",
  name: "warehouse",
  engine: "sqlite",
  readOnly: false,
  filePath: "/tmp/warehouse.db",
  environment: "prod",
};

const pg: ConnectionProfile = {
  id: "p2",
  name: "reporting",
  engine: "postgres",
  readOnly: false,
  host: "localhost",
  port: 5432,
  database: "analytics",
};

const tree = {
  namespaces: [{ name: "public", relations: [{ name: "users", kind: "table" as const }] }],
};

/** Every command the panel can reach; `connect` is the case under test. */
function mock(connect: (args: { profileId?: string; database?: string; password?: string }) => unknown, calls: string[] = []): void {
  mockIPC((cmd, args) => {
    calls.push(cmd);
    if (cmd === "list_connections") return [sqlite, pg];
    if (cmd === "connect") return connect(args as never);
    if (cmd === "list_databases") return ["analytics", "billing"];
    if (cmd === "introspect") return tree;
    return undefined;
  });
}

// The backend resolves the maintenance database when a pg profile names none;
// the mock just echoes whichever database the session opened.
let opened = 0;
const session = (args: { profileId?: string; database?: string }) => {
  const profile = args.profileId === pg.id ? pg : sqlite;
  return {
    sessionId: `s${++opened}`,
    profileId: profile.id,
    engine: profile.engine,
    readOnly: false,
    database: args.database ?? profile.database,
  };
};

const root = (name: RegExp) => screen.findByRole("treeitem", { name });

// The store is a module singleton, so a session opened by one case is still open
// in the next one — and a root that is already connected does not connect again.
beforeEach(async () => {
  for (const t of [...toasts.items]) toasts.dismiss(t.id);
  mockIPC(() => undefined);
  await connections.disconnect(sqlite.id);
  await connections.disconnect(pg.id);
  connections.setActive(null);
  clearMocks();
});

afterEach(clearMocks);

// The panel is the connection list *and* the schema browser — pgAdmin's shape.
// Every saved profile is a root whether or not it holds a session, and expanding
// one is what connects it.
describe("ConnectionsPanel", () => {
  it("roots the tree at every saved connection, connected or not", async () => {
    mock(session);
    render(ConnectionsPanel);

    expect(await root(/warehouse/)).toHaveAttribute("aria-expanded", "false");
    expect(await root(/reporting/)).toHaveAttribute("aria-expanded", "false");
  });

  it("marks a connection's environment on its root", async () => {
    mock(session);
    render(ConnectionsPanel);

    expect(await root(/warehouse/)).toHaveTextContent("Prod");
  });

  it("connects on expand, points the workspace at it and shows its schema", async () => {
    mock(session);
    render(ConnectionsPanel);

    await fireEvent.click(await root(/warehouse/));

    expect(await root(/public/)).toBeInTheDocument();
    expect(connections.active?.profileId).toBe(sqlite.id);
  });

  // A Postgres root opens onto the server's *databases*, not its schemas: a pg
  // connection is bound to the database it opened, so the schemas under it are
  // only ever one database's worth. The maintenance session discovers the list.
  it("lists the server's databases when a Postgres root is expanded", async () => {
    const calls: string[] = [];
    mock(session, calls);
    render(ConnectionsPanel);

    await fireEvent.click(await root(/reporting/));

    expect(await root(/billing/)).toBeInTheDocument();
    expect(calls).toContain("list_databases");
    expect(calls).not.toContain("introspect");
  });

  // Expanding a database *opens* it, because there is no other way to read it —
  // the maintenance session cannot see across into it.
  it("opens a database as its own session and introspects that one", async () => {
    const calls: string[] = [];
    mock(session, calls);
    render(ConnectionsPanel);

    await fireEvent.click(await root(/reporting/));
    await fireEvent.click(await root(/billing/));

    expect(await root(/public/)).toBeInTheDocument();
    expect(calls.filter((c) => c === "connect")).toHaveLength(2);
    expect(connections.active?.database).toBe("billing");
  });

  // The profile's own database is already open on the maintenance session, so
  // expanding its row must reuse it rather than pay for a second pool.
  it("reuses the server session for the database the profile already opened", async () => {
    const calls: string[] = [];
    mock(session, calls);
    render(ConnectionsPanel);

    await fireEvent.click(await root(/reporting/));
    await fireEvent.click(await root(/analytics/));

    expect(await root(/public/)).toBeInTheDocument();
    expect(calls.filter((c) => c === "connect")).toHaveLength(1);
  });

  // Every grid commit and editor run resolves the *active* session at execute
  // time. A click on a connected root re-pointed it at the root's own session —
  // for Postgres, the maintenance database — so collapsing the tree could send a
  // staged UPDATE to a different database than the one it was staged against.
  it("leaves the workspace pointed at the database when the root is clicked", async () => {
    mock(session);
    render(ConnectionsPanel);

    await fireEvent.click(await root(/reporting/));
    await fireEvent.click(await root(/billing/));
    await waitFor(() => expect(connections.active?.database).toBe("billing"));

    await fireEvent.click(await root(/reporting/));

    expect(connections.active?.database).toBe("billing");
  });

  // The empty branch used to name privileges as the cause. Three filters can
  // empty that list, and only one of them is a privilege.
  it("claims no cause the database query did not check", async () => {
    mockIPC((cmd, args) => {
      if (cmd === "list_connections") return [pg];
      if (cmd === "connect") return session(args as never);
      if (cmd === "list_databases") return [];
      return undefined;
    });
    render(ConnectionsPanel);

    await fireEvent.click(await root(/reporting/));

    expect(await screen.findByText("This server has no database this role can open.")).toBeInTheDocument();
  });

  // One announcement, wherever the connect was triggered from, and the root
  // closes rather than sitting open and empty.
  it("announces a failed connect as a toast and re-collapses the root", async () => {
    mock(() => {
      throw { kind: "connectionRefused", message: "connection refused" };
    });
    render(ConnectionsPanel);
    const warehouse = await root(/warehouse/);

    await fireEvent.click(warehouse);

    await waitFor(() => expect(toasts.items.at(-1)?.message).toMatch(/^Connect to “warehouse”/));
    await waitFor(() => expect(warehouse).toHaveAttribute("aria-expanded", "false"));
  });

  // A rejected password is fixed by typing one, so it asks rather than only
  // announcing — and declining falls back to the announcement.
  it("asks for a password on authFailed and toasts when declined", async () => {
    mock(() => {
      throw { kind: "authFailed", message: "password authentication failed" };
    });
    render(ConnectionsPanel);

    await fireEvent.click(await root(/warehouse/));
    await waitFor(() => expect(connections.passwordRequest?.kind).toBe("authFailed"));
    connections.passwordRequest?.answer(null);

    await waitFor(() =>
      expect(toasts.items.at(-1)?.message).toBe("Connect to “warehouse”: Authentication failed"),
    );
    expect(connections.active).toBeNull();
  });

  it("retries with the typed password", async () => {
    const passwords: unknown[] = [];
    mock((args) => {
      passwords.push(args.password);
      if (args.password !== "hunter2") throw { kind: "authFailed", message: "denied" };
      return session(args);
    });
    render(ConnectionsPanel);

    await fireEvent.click(await root(/warehouse/));
    await waitFor(() => expect(connections.passwordRequest).not.toBeNull());
    connections.passwordRequest?.answer({ password: "hunter2", remember: false });

    await waitFor(() => expect(connections.active?.profileId).toBe(sqlite.id));
    expect(passwords).toEqual([undefined, "hunter2"]);
  });

  it("offers disconnect and the profile's own actions on a connected root", async () => {
    mock(session);
    await connections.load();
    await connections.connect(sqlite.id);
    render(ConnectionsPanel);

    await fireEvent.contextMenu(await root(/warehouse/), { clientX: 10, clientY: 10 });
    expect(screen.getByRole("menuitem", { name: /Edit/ })).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("menuitem", { name: /Disconnect/ }));

    await waitFor(() => expect(connections.statusFor(sqlite.id).status).toBe("disconnected"));
  });

  it("offers the connection form when there are none saved", async () => {
    mockIPC((cmd) => (cmd === "list_connections" ? [] : undefined));
    render(ConnectionsPanel);

    expect(await screen.findByText("No connections yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New connection" })).toBeInTheDocument();
  });
});
