import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { afterEach, describe, expect, it } from "vitest";
import { schema } from "./schema.svelte";

const tree = {
  namespaces: [{ name: "public", relations: [{ name: "users", kind: "table" as const }] }],
};

// `describe_table` echoes what it was asked for, so a cache hit on the wrong key
// is visible in the answer rather than merely plausible.
function mock(): void {
  mockIPC((cmd, args) => {
    if (cmd === "introspect") return tree;
    if (cmd === "list_databases") return ["analytics", "billing"];
    if (cmd === "describe_table") {
      const { namespace, table } = args as { namespace: string; table: string };
      return {
        columns: [{ name: `${namespace}/${table}`, typeName: "text", nullable: true, isPk: false }],
        indexes: [],
      };
    }
    return undefined;
  });
}

// Each case uses its own session id: the store is a module singleton.
afterEach(clearMocks);

describe("schema store", () => {
  // A Postgres server session owns both caches, and two different rows refresh
  // them — the connection root the list, a database node its own relations. One
  // `clear` for both meant a database's Refresh unmounted the whole branch,
  // taking every sibling's expansion state with it.
  it("clears a session's relations without dropping its database list", async () => {
    mock();
    await schema.loadTree("s-tree");
    await schema.loadDatabases("s-tree");
    await schema.describe("s-tree", "public", "users");

    schema.clearTree("s-tree");

    expect(schema.get("s-tree")).toBeUndefined();
    expect(schema.describeCached("s-tree", "public", "users")).toBeUndefined();
    expect(schema.databases("s-tree")?.list).toEqual(["analytics", "billing"]);
  });

  it("clears a session's database list without dropping its relations", async () => {
    mock();
    await schema.loadTree("s-dbs");
    await schema.loadDatabases("s-dbs");

    schema.clearDatabases("s-dbs");

    expect(schema.databases("s-dbs")).toBeUndefined();
    expect(schema.get("s-dbs")?.tree).toEqual(tree);
  });

  it("clears both when the session itself is gone", async () => {
    mock();
    await schema.loadTree("s-gone");
    await schema.loadDatabases("s-gone");

    schema.clear("s-gone");

    expect(schema.get("s-gone")).toBeUndefined();
    expect(schema.databases("s-gone")).toBeUndefined();
  });

  // The column cache key joins session, namespace and table. Identifiers may
  // contain spaces, so a space separator let `("a", "b c")` and `("a b", "c")` —
  // two different tables — collide on one entry.
  it("keys the column cache so a name containing a space cannot collide", async () => {
    mock();
    const outer = await schema.describe("s-keys", "a", "b c");
    const inner = await schema.describe("s-keys", "a b", "c");

    expect(outer?.columns[0].name).toBe("a/b c");
    expect(inner?.columns[0].name).toBe("a b/c");
    expect(schema.describeCached("s-keys", "a", "b c")?.columns[0].name).toBe("a/b c");
  });
});
