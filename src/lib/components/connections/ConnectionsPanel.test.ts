import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ConnectionProfile } from "$lib/api/types";
import { connections } from "$lib/stores/connections.svelte";
import { panel } from "$lib/stores/panel.svelte";
import { toasts } from "$lib/stores/toasts.svelte";
import ConnectionsPanel from "./ConnectionsPanel.svelte";

const profile: ConnectionProfile = {
  id: "p1",
  name: "warehouse",
  engine: "sqlite",
  readOnly: false,
  filePath: "/tmp/warehouse.db",
};

function mock(connect: () => unknown): void {
  mockIPC((cmd) => {
    if (cmd === "list_connections") return [profile];
    if (cmd === "connect") return connect();
    return undefined;
  });
}

const session = () => ({ sessionId: "s1", profileId: "p1", engine: "sqlite", readOnly: false });

beforeEach(async () => {
  for (const t of [...toasts.items]) toasts.dismiss(t.id);
  mockIPC(() => undefined);
  await connections.disconnect(profile.id);
  connections.setActive(null);
  panel.select("connections");
  clearMocks();
});

afterEach(clearMocks);

describe("ConnectionsPanel", () => {
  it("lists every saved connection", async () => {
    mock(session);
    render(ConnectionsPanel);

    expect(await screen.findByRole("button", { name: /warehouse/ })).toBeInTheDocument();
  });

  // Opening a connection is for looking at it, so the panel moves to its schema.
  it("opens a connection, points the workspace at it and shows its schema", async () => {
    mock(session);
    render(ConnectionsPanel);

    await fireEvent.click(await screen.findByRole("button", { name: /warehouse/ }));

    await waitFor(() => expect(panel.active).toBe("schema"));
    expect(connections.active?.sessionId).toBe("s1");
  });

  it("stays put and announces a failed connect as a toast", async () => {
    mock(() => {
      throw { kind: "authFailed", message: "password authentication failed" };
    });
    render(ConnectionsPanel);

    await fireEvent.click(await screen.findByRole("button", { name: /warehouse/ }));

    await waitFor(() =>
      expect(toasts.items.at(-1)?.message).toBe("Connect to “warehouse”: Authentication failed"),
    );
    expect(panel.active).toBe("connections");
  });

  it("offers a disconnect on a connected row", async () => {
    mock(session);
    await connections.load();
    await connections.connect(profile.id);
    render(ConnectionsPanel);

    await fireEvent.click(screen.getByRole("button", { name: "Disconnect “warehouse”" }));

    await waitFor(() => expect(connections.statusFor(profile.id).status).toBe("disconnected"));
  });

  it("offers the connection form when there are none saved", async () => {
    mockIPC((cmd) => (cmd === "list_connections" ? [] : undefined));
    render(ConnectionsPanel);

    expect(await screen.findByText("No connections yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New connection" })).toBeInTheDocument();
  });
});
