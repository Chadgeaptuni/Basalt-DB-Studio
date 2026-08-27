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
  mockIPC((cmd) => {
    calls.push(cmd);
    if (cmd === "list_connections") return [profile];
    if (cmd === "connect") {
      return { sessionId: "s1", profileId: "p1", engine: "postgres", readOnly: false };
    }
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

  it("connects and introspects when a root is expanded", async () => {
    const calls: string[] = [];
    mock(calls);
    render(SchemaTree);

    await fireEvent.click(await screen.findByRole("treeitem", { name: /warehouse/ }));

    expect(await screen.findByRole("treeitem", { name: /public/ })).toBeInTheDocument();
    expect(calls).toContain("connect");
    expect(calls).toContain("introspect");
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
    expect(root).toHaveAttribute("aria-expanded", "false");
  });
});
