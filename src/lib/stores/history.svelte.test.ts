import { describe, it, expect, beforeEach } from "vitest";
import { history } from "./history.svelte";

describe("history", () => {
  beforeEach(() => history.clear());

  it("keeps the newest entry first", () => {
    history.push({ sql: "SELECT 1", engine: "sqlite", ok: true, rowCount: 1, durationMs: 2 });
    history.push({ sql: "SELECT 2", engine: "sqlite", ok: true, rowCount: 1, durationMs: 3 });
    expect(history.list[0].sql).toBe("SELECT 2");
  });

  it("caps the log at 200 entries", () => {
    for (let i = 0; i < 250; i++) {
      history.push({ sql: `SELECT ${i}`, engine: "sqlite", ok: true, rowCount: null, durationMs: 1 });
    }
    expect(history.list).toHaveLength(200);
    // Newest survives, oldest evicted.
    expect(history.list[0].sql).toBe("SELECT 249");
  });
});
