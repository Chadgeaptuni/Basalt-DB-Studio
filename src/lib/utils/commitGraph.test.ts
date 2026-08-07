import { describe, expect, it } from "vitest";
import type { Commit } from "$lib/api/gitsync";
import { buildGraph, laneCount } from "./commitGraph";

// Commits newest-first, the order `git log` returns and the graph assumes.
const commit = (hash: string, parents: string[]): Commit => ({
  hash,
  short: hash,
  parents,
  author: "Ada",
  email: "ada@example.com",
  date: "2026-08-07T10:00:00Z",
  subject: hash,
  refs: [],
});

const lanesOf = (commits: Commit[]): Record<string, number> =>
  Object.fromEntries(buildGraph(commits).map((r) => [r.commit.hash, r.lane]));

describe("buildGraph", () => {
  it("keeps a straight history in one lane", () => {
    const rows = buildGraph([commit("c", ["b"]), commit("b", ["a"]), commit("a", [])]);

    expect(rows.map((r) => r.lane)).toEqual([0, 0, 0]);
    expect(laneCount(rows)).toBe(1);
  });

  // The root closes its lane: nothing is left waiting for a parent that does not
  // exist, so the next branch reuses column 0 instead of starting at 1.
  it("closes the lane at a root commit", () => {
    const rows = buildGraph([commit("a", [])]);
    expect(rows[0].edges.filter((e) => e.fromNode)).toEqual([]);
  });

  it("gives a diverged branch a lane of its own", () => {
    //   d   e      two tips
    //   |   |
    //   b   c
    //    \ /
    //     a
    const lanes = lanesOf([
      commit("d", ["b"]),
      commit("e", ["c"]),
      commit("b", ["a"]),
      commit("c", ["a"]),
      commit("a", []),
    ]);

    expect(lanes.d).toBe(0);
    expect(lanes.e).toBe(1);
    // The shared ancestor sits in the leftmost lane still waiting for it.
    expect(lanes.a).toBe(0);
  });

  // A merge has two parents, so it emits two outgoing edges — that fork is the
  // whole visual signal that a merge happened.
  it("draws one edge per parent out of a merge", () => {
    const rows = buildGraph([
      commit("m", ["a", "b"]),
      commit("a", ["r"]),
      commit("b", ["r"]),
      commit("r", []),
    ]);

    const merge = rows[0];
    expect(merge.commit.parents).toHaveLength(2);
    const out = merge.edges.filter((e) => e.fromNode);
    expect(out).toHaveLength(2);
    expect(new Set(out.map((e) => e.to)).size).toBe(2);
  });

  // Both sides of the merge converge on the same root, and the root occupies one
  // lane — not one per branch that reached it.
  it("converges two branches onto a shared ancestor", () => {
    const rows = buildGraph([
      commit("m", ["a", "b"]),
      commit("a", ["r"]),
      commit("b", ["r"]),
      commit("r", []),
    ]);

    const root = rows[3];
    expect(root.commit.hash).toBe("r");
    // Every lane that was waiting for the root arrives at the root's own lane.
    for (const edge of root.edges.filter((e) => !e.fromNode)) {
      expect(edge.to).toBe(root.lane);
    }
  });

  // The point of reuse: a repo with many short-lived branches must not grow a
  // column per branch that ever existed.
  it("reuses a lane once its branch has ended", () => {
    const rows = buildGraph([
      commit("d", ["c"]),
      commit("side", []), // an orphan tip that closes immediately
      commit("c", ["b"]),
      commit("b", ["a"]),
      commit("a", []),
    ]);

    expect(laneCount(rows)).toBe(2);
  });

  it("never emits an edge to a lane it did not open", () => {
    const rows = buildGraph([
      commit("m", ["a", "b"]),
      commit("a", ["r"]),
      commit("b", ["r"]),
      commit("r", []),
    ]);

    const widest = laneCount(rows);
    for (const row of rows) {
      for (const edge of row.edges) {
        expect(edge.from).toBeGreaterThanOrEqual(0);
        expect(edge.to).toBeGreaterThanOrEqual(0);
        expect(edge.from).toBeLessThan(widest);
        expect(edge.to).toBeLessThan(widest);
      }
    }
  });

  it("handles an empty history", () => {
    expect(buildGraph([])).toEqual([]);
    expect(laneCount([])).toBe(1);
  });
});
