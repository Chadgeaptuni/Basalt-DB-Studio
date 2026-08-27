import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { render, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ConnectionProfile } from "$lib/api/types";
import { connections } from "$lib/stores/connections.svelte";
import ConnectionLabel from "./ConnectionLabel.svelte";

const profile: ConnectionProfile = {
  id: "p1",
  name: "warehouse",
  engine: "postgres",
  readOnly: false,
  host: "localhost",
  port: 5432,
  database: "postgres",
};

beforeEach(() => {
  mockIPC((cmd) => (cmd === "list_connections" ? [profile] : undefined));
});

// The store is a module singleton, so the session one case makes active is still
// active in the next. Without this reset the first case passed only by virtue of
// running first, and the disconnected reading could not be asserted at all.
afterEach(() => {
  clearMocks();
  connections.setActive(null);
});

describe("ConnectionLabel", () => {
  // A Postgres profile holds one session per database it has open, and the
  // status bar is pointed at whichever is active — which is usually *not* the
  // server session. Looking the profile up by that one read "Not connected"
  // while the workspace was very much connected.
  it("names the profile when a database session is the active one", async () => {
    render(ConnectionLabel);
    await screen.findByText("Not connected");

    connections.setActive({
      sessionId: "s2",
      profileId: "p1",
      engine: "postgres",
      readOnly: false,
      database: "billing",
    });

    expect(await screen.findByText("warehouse")).toBeInTheDocument();
    expect(screen.queryByText("Not connected")).not.toBeInTheDocument();
  });

  it("reads as disconnected when no session is active", async () => {
    render(ConnectionLabel);

    expect(await screen.findByText("Not connected")).toBeInTheDocument();
  });

  // With several databases open under one profile, the name alone no longer says
  // which session you are about to run a statement against.
  it("names the database, because the profile name no longer identifies the session", async () => {
    render(ConnectionLabel);
    connections.setActive({
      sessionId: "s3",
      profileId: "p1",
      engine: "postgres",
      readOnly: false,
      database: "analytics",
    });

    expect(await screen.findByText("/analytics")).toBeInTheDocument();
  });
});
