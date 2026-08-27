import { describe, it, expect, afterEach } from "vitest";
import { mockIPC, clearMocks } from "@tauri-apps/api/mocks";
import { connections } from "./connections.svelte";
import { schema } from "./schema.svelte";
import type { ConnectionProfile } from "$lib/api/types";

const sqliteProfile: ConnectionProfile = {
  id: "p1",
  name: "local",
  engine: "sqlite",
  readOnly: false,
  filePath: "/tmp/x.db",
};

/** A Postgres server that hands out one session per connect, echoing whichever
 *  database was asked for. `counted.n` is the number of pools opened. */
function pgServer(profileId: string, maintenance: string): { n: number } {
  const counted = { n: 0 };
  mockIPC((cmd, args) => {
    if (cmd === "connect") {
      counted.n += 1;
      return {
        sessionId: `${profileId}-s${counted.n}`,
        profileId,
        engine: "postgres",
        readOnly: false,
        database: (args as { database?: string }).database ?? maintenance,
      };
    }
    if (cmd === "introspect") return { namespaces: [] };
    return undefined;
  });
  return counted;
}

describe("connections store", () => {
  afterEach(() => {
    clearMocks();
    connections.setActive(null);
  });

  it("loads profiles from the backend", async () => {
    mockIPC((cmd) => {
      if (cmd === "list_connections") return [sqliteProfile];
      return undefined;
    });
    await connections.load();
    expect(connections.loaded).toBe(true);
    expect(connections.loadError).toBeNull();
    expect(connections.profiles.map((p) => p.id)).toContain("p1");
  });

  it("marks a session connected and active on success", async () => {
    mockIPC((cmd) => {
      if (cmd === "connect") {
        return { sessionId: "s1", profileId: "p1", engine: "sqlite", readOnly: false };
      }
      return undefined;
    });
    const session = await connections.connect("p1");
    expect(session?.sessionId).toBe("s1");
    expect(connections.statusFor("p1").status).toBe("connected");
    expect(connections.active?.sessionId).toBe("s1");
  });

  it("activates an existing session instead of opening a second one", async () => {
    let connects = 0;
    mockIPC((cmd) => {
      if (cmd === "connect") {
        connects += 1;
        return { sessionId: `s${connects}`, profileId: "p1", engine: "sqlite", readOnly: false };
      }
      return undefined;
    });

    await connections.activate("p-act"); // first open → connects
    connections.setActive({ sessionId: "other", profileId: "p9", engine: "sqlite", readOnly: false });
    await connections.activate("p-act"); // already holds a session → refocus

    expect(connects).toBe(1);
    expect(connections.active?.sessionId).toBe("s1");
  });

  it("captures a typed connect failure as an error status", async () => {
    mockIPC((cmd) => {
      if (cmd === "connect") throw { kind: "connectionRefused", message: "refused" };
      return undefined;
    });
    const session = await connections.connect("p2");
    expect(session).toBeNull();
    const st = connections.statusFor("p2");
    expect(st.status).toBe("error");
    expect(st.error?.kind).toBe("connectionRefused");
  });

  // Collapsing and re-expanding a database row while the first connect was still
  // in flight opened a second pool and filed it over the first, whose session id
  // nothing could reach again — it stayed open for the life of the app.
  it("opens one pool when the same database is asked for twice at once", async () => {
    const opened = pgServer("p-race", "postgres");

    const [first, second] = await Promise.all([
      connections.connectDatabase("p-race", "billing"),
      connections.connectDatabase("p-race", "billing"),
    ]);

    expect(opened.n).toBe(1);
    expect(first?.sessionId).toBe(second?.sessionId);
    expect(connections.sessionsFor("p-race")).toHaveLength(1);
  });

  // The profile names a database, so the server session already holds it. The
  // dedupe lives in the store, not in the tree: connectDatabase is exported, and
  // a caller that re-derived the rule differently would open a second pool onto
  // a database that is already open.
  it("reuses the server session for the database the profile itself named", async () => {
    const opened = pgServer("p-reuse", "analytics");

    const server = await connections.connect("p-reuse");
    const reused = await connections.connectDatabase("p-reuse", "analytics");

    expect(opened.n).toBe(1);
    expect(reused?.sessionId).toBe(server?.sessionId);
    expect(connections.databaseStateFor("p-reuse", "analytics").session?.sessionId).toBe(
      server?.sessionId,
    );
    expect(connections.databaseStateFor("p-reuse", "analytics").status).toBe("connected");
  });

  // `activate` is what the command palette runs. Focusing the profile's server
  // session pointed the workspace at the maintenance database — with nothing to
  // show it but a suffix in the status bar — however many databases were open.
  it("activates a database session rather than the maintenance one", async () => {
    const opened = pgServer("p-palette", "postgres");

    await connections.connect("p-palette");
    await connections.connectDatabase("p-palette", "billing");
    connections.setActive({
      sessionId: "elsewhere",
      profileId: "p-other",
      engine: "sqlite",
      readOnly: false,
    });

    await connections.activate("p-palette");

    expect(connections.active?.database).toBe("billing");
    expect(opened.n).toBe(2);
  });

  // The server session and every other database under it are still connected, so
  // dropping the workspace to "Not connected" sent the user hunting through the
  // tree to get back somewhere they never left.
  it("falls back to the server session when a database is disconnected", async () => {
    pgServer("p-fallback", "postgres");

    const server = await connections.connect("p-fallback");
    const database = await connections.connectDatabase("p-fallback", "billing");
    await schema.loadTree(database!.sessionId);
    expect(schema.get(database!.sessionId)?.tree).toBeDefined();

    await connections.disconnectDatabase("p-fallback", "billing");

    expect(connections.active?.sessionId).toBe(server?.sessionId);
    // The cache is keyed by session id, so a closed session's tree is unreachable
    // garbage that would sit in the store for the life of the app.
    expect(schema.get(database!.sessionId)).toBeUndefined();
    expect(connections.sessionsFor("p-fallback")).toHaveLength(1);
  });

  it("clears the workspace when the profile's own session goes away", async () => {
    pgServer("p-closed", "postgres");

    const server = await connections.connect("p-closed");
    await connections.connectDatabase("p-closed", "billing");
    await schema.loadTree(server!.sessionId);

    await connections.disconnect("p-closed");

    expect(connections.active).toBeNull();
    expect(connections.sessionsFor("p-closed")).toHaveLength(0);
    expect(schema.get(server!.sessionId)).toBeUndefined();
  });
});
