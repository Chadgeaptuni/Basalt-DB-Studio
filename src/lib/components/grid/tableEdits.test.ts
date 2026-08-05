import { describe, it, expect } from "vitest";
import { buildEdits, parseCell, pendingCount, cellEq } from "./tableEdits";
import type { BrowseResult } from "$lib/api/types";

const browse: BrowseResult = {
  columns: [
    { name: "id", typeName: "int", nullable: false, isPk: true },
    { name: "name", typeName: "text", nullable: true, isPk: false },
  ],
  rows: [
    [{ kind: "int", value: 1 }, { kind: "text", value: "a" }],
    [{ kind: "int", value: 2 }, { kind: "text", value: "b" }],
  ],
  truncated: false,
  keyColumns: ["id"],
  keyIsFallback: false,
  editable: true,
  sql: 'SELECT "id", "name" FROM "main"."t" LIMIT 501',
  durationMs: 1,
};

describe("parseCell", () => {
  it("keeps a bool cell a bool (so MySQL tinyint(1) gets 1/0)", () => {
    expect(parseCell("false", "bool")).toEqual({ kind: "bool", value: false });
    expect(parseCell("1", "bool")).toEqual({ kind: "bool", value: true });
  });
  it("parses ints/floats and falls back to text when unparseable", () => {
    expect(parseCell("42", "int")).toEqual({ kind: "int", value: 42 });
    expect(parseCell("x", "int")).toEqual({ kind: "text", value: "x" });
    expect(parseCell("1.5", "float")).toEqual({ kind: "float", value: 1.5 });
  });
  it("keeps decimals exact and json/array as raw text", () => {
    expect(parseCell("2.50", "decimal")).toEqual({ kind: "decimal", value: "2.50" });
    expect(parseCell("[1,2]", "json")).toEqual({ kind: "text", value: "[1,2]" });
  });
});

describe("buildEdits", () => {
  it("emits update with PK identity, delete, and insert", () => {
    const edits = { 0: { 1: { kind: "text", value: "A" } as const } };
    const deletes = { 1: true as const };
    const inserts = [{ cells: { 0: { kind: "int", value: 3 } as const, 1: { kind: "text", value: "c" } as const } }];
    const out = buildEdits(browse, edits, deletes, inserts);

    expect(out).toContainEqual({
      op: "update",
      key: [{ kind: "int", value: 1 }],
      set: [{ column: "name", value: { kind: "text", value: "A" } }],
    });
    expect(out).toContainEqual({ op: "delete", key: [{ kind: "int", value: 2 }] });
    expect(out).toContainEqual({
      op: "insert",
      set: [
        { column: "id", value: { kind: "int", value: 3 } },
        { column: "name", value: { kind: "text", value: "c" } },
      ],
    });
  });

  it("drops updates on rows also marked for deletion", () => {
    const out = buildEdits(browse, { 1: { 1: { kind: "text", value: "z" } } }, { 1: true }, []);
    expect(out).toEqual([{ op: "delete", key: [{ kind: "int", value: 2 }] }]);
  });
});

describe("pendingCount / cellEq", () => {
  it("counts edited cells, deletes, and non-empty inserts", () => {
    expect(pendingCount({ 0: { 1: { kind: "text", value: "A" } } }, { 1: true }, [{ cells: {} }])).toBe(2);
  });
  it("treats structurally equal cells as equal", () => {
    expect(cellEq({ kind: "int", value: 1 }, { kind: "int", value: 1 })).toBe(true);
    expect(cellEq({ kind: "int", value: 1 }, { kind: "null" })).toBe(false);
  });
});
