import { describe, it, expect } from "vitest";
import { sortedOrder, type SortState } from "./gridView";
import type { CellValue } from "$lib/api/types";

const int = (n: number): CellValue => ({ kind: "int", value: n });
const text = (s: string): CellValue => ({ kind: "text", value: s });
const nul = (): CellValue => ({ kind: "null" });

const asc = (column: number): SortState => ({ column, dir: "asc" });
const desc = (column: number): SortState => ({ column, dir: "desc" });

describe("sortedOrder", () => {
  it("returns identity order when nothing is sorted", () => {
    const rows = [[int(3)], [int(1)], [int(2)]];
    expect(sortedOrder(rows, null)).toEqual([0, 1, 2]);
  });

  it("sorts numbers numerically, not as strings", () => {
    const rows = [[int(10)], [int(9)], [int(100)]];
    expect(sortedOrder(rows, asc(0))).toEqual([1, 0, 2]);
  });

  it("reverses on desc", () => {
    const rows = [[int(1)], [int(3)], [int(2)]];
    expect(sortedOrder(rows, desc(0))).toEqual([1, 2, 0]);
  });

  // NULL is absence, not a smallest value: flipping it to the top on desc would
  // bury the rows the user actually asked to see.
  it("keeps NULLs last in both directions", () => {
    const rows = [[nul()], [int(2)], [int(1)]];
    expect(sortedOrder(rows, asc(0))).toEqual([2, 1, 0]);
    expect(sortedOrder(rows, desc(0))).toEqual([1, 2, 0]);
  });

  it("sorts text case-insensitively and numerically-aware", () => {
    const rows = [[text("item10")], [text("Item2")], [text("item1")]];
    expect(sortedOrder(rows, asc(0))).toEqual([2, 1, 0]);
  });

  it("is stable: equal values keep their original order", () => {
    const rows = [[int(1)], [int(1)], [int(1)], [int(0)]];
    expect(sortedOrder(rows, asc(0))).toEqual([3, 0, 1, 2]);
  });

  it("sorts by the requested column only", () => {
    const rows = [
      [int(1), text("c")],
      [int(2), text("a")],
      [int(3), text("b")],
    ];
    expect(sortedOrder(rows, asc(1))).toEqual([1, 2, 0]);
  });

  // Regression: the grid stages edits by row index, so the sort must hand back
  // indices into the original rows — reordered rows would commit to the wrong ones.
  it("returns indices into the original rows", () => {
    const rows = [[int(3)], [int(1)], [int(2)]];
    const order = sortedOrder(rows, asc(0));
    expect(order.map((i) => rows[i][0])).toEqual([int(1), int(2), int(3)]);
    expect(rows[0][0]).toEqual(int(3)); // input untouched
  });

  it("survives a ragged row missing the sorted column", () => {
    const rows = [[int(2)], [], [int(1)]];
    expect(() => sortedOrder(rows, asc(0))).not.toThrow();
  });
});
