import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { afterEach, describe, expect, it } from "vitest";
import type { ConnectionProfile, SessionInfo } from "$lib/api/types";
import { connections } from "$lib/stores/connections.svelte";
import { schema } from "$lib/stores/schema.svelte";
import { branchIndent, hasDatabaseLevel, refreshProfile, refreshSession } from "./tree";

const profile: ConnectionProfile = {
  id: "p-refresh",
  name: "warehouse",
  engine: "postgres",
  readOnly: false,
  host: "localhost",
  port: 5432,
  database: "analytics",
};

/** A connected server with one further database open under it, both introspected
 *  — the shape the two Refresh rows disagreed about. */
async function openServerAndDatabase(): Promise<{ server: SessionInfo; database: SessionInfo }> {
  let opened = 0;
  mockIPC((cmd, args) => {
    if (cmd === "connect") {
      opened += 1;
      return {
        sessionId: `s${opened}`,
        profileId: profile.id,
        engine: "postgres",
        readOnly: false,
        database: (args as { database?: string }).database ?? profile.database,
      };
    }
    if (cmd === "list_databases") return ["analytics", "billing"];
    if (cmd === "introspect") return { namespaces: [] };
    return undefined;
  });

  const server = await connections.connect(profile.id);
  const database = await connections.connectDatabase(profile.id, "billing");
  await schema.loadDatabases(server!.sessionId);
  await schema.loadTree(server!.sessionId);
  await schema.loadTree(database!.sessionId);
  return { server: server!, database: database! };
}

afterEach(async () => {
  mockIPC(() => undefined);
  await connections.disconnect(profile.id);
  clearMocks();
  connections.setActive(null);
});

describe("schema tree rules", () => {
  it("draws a database level for Postgres only", () => {
    expect(hasDatabaseLevel(profile)).toBe(true);
    expect(hasDatabaseLevel({ ...profile, engine: "mysql" })).toBe(false);
    expect(hasDatabaseLevel({ ...profile, engine: "sqlite" })).toBe(false);
  });

  // One step per level, landing under the label rather than the chevron. Three
  // components indented branch rows by this formula, each with its own copy.
  it("indents a branch row one level below its node", () => {
    expect(branchIndent(1)).toBe(32);
    expect(branchIndent(2)).toBe(44);
  });

  // The row for the database the profile itself names *is* the server session, so
  // clearing everything cached under it took the database list with it — the list
  // this row's own siblings are drawn from.
  it("refreshes a session's relations without dropping the database list", async () => {
    const { server } = await openServerAndDatabase();

    refreshSession(server.sessionId);

    expect(schema.get(server.sessionId)).toBeUndefined();
    expect(schema.databases(server.sessionId)?.list).toEqual(["analytics", "billing"]);
  });

  // Refreshing the root cleared the server session alone. The database list
  // re-loaded, so the branch flickered as though it had worked, while every
  // database open below it kept its stale tree.
  it("refreshes every database open under a connection root", async () => {
    const { server, database } = await openServerAndDatabase();

    refreshProfile(profile);

    expect(schema.databases(server.sessionId)).toBeUndefined();
    expect(schema.get(server.sessionId)).toBeUndefined();
    expect(schema.get(database.sessionId)).toBeUndefined();
  });
});
