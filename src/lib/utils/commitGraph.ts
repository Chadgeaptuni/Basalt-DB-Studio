import type { Commit } from "$lib/api/gitsync";

// Lane assignment for the history graph: turns a list of commits and their
// parents into "which column is this commit in, and which columns are passing
// through beside it".
//
// This is layout, not git, which is why it is here rather than in Rust: the
// backend returns the DAG's shape and takes no view on how it is drawn.
//
// The algorithm is the one every graph log uses. Walk the commits newest-first,
// keeping a list of *open lanes* — hashes we are still waiting to see. A commit
// takes the leftmost lane already waiting for it, or a new one if nothing is; its
// first parent inherits that lane, and any other parent (a merge) opens one of its
// own. Lanes are reused as soon as they close, so the graph stays narrow instead
// of growing a column per branch that ever existed.

export interface GraphRow {
  commit: Commit;
  /** Column this commit's node sits in. */
  lane: number;
  /** Every lane occupied on this row, and where each one goes next. */
  edges: GraphEdge[];
}

export interface GraphEdge {
  /** Lane the line comes from, above this row. */
  from: number;
  /** Lane it continues in, below this row. */
  to: number;
  /** True when this edge starts at *this* row's commit — a parent link. */
  fromNode: boolean;
}

/** Widest lane index used, so the caller can size the gutter once. */
export function laneCount(rows: GraphRow[]): number {
  let widest = 0;
  for (const row of rows) {
    for (const edge of row.edges) widest = Math.max(widest, edge.from, edge.to);
    widest = Math.max(widest, row.lane);
  }
  return widest + 1;
}

export function buildGraph(commits: Commit[]): GraphRow[] {
  // Index by lane. A `null` slot is a lane that has closed and is free to reuse.
  const open: (string | null)[] = [];
  const rows: GraphRow[] = [];

  const claim = (hash: string): number => {
    const free = open.indexOf(null);
    if (free !== -1) {
      open[free] = hash;
      return free;
    }
    open.push(hash);
    return open.length - 1;
  };

  for (const commit of commits) {
    // Every lane waiting for this commit converges here. More than one means two
    // branches meet at this commit — the lines merge into its lane.
    const waiting = open.reduce<number[]>(
      (found, hash, i) => (hash === commit.hash ? [...found, i] : found),
      [],
    );
    const lane = waiting.length > 0 ? waiting[0] : claim(commit.hash);

    // Snapshot before reassigning: the edges above this row describe the lanes as
    // they were when the previous row was drawn.
    const before = [...open];

    // The first parent continues in this commit's own lane; the rest branch off.
    // A commit with no parents is a root, and its lane closes here.
    open[lane] = commit.parents[0] ?? null;
    for (const extra of waiting.slice(1)) open[extra] = null;
    for (const parent of commit.parents.slice(1)) {
      // A parent already on screen keeps its lane rather than opening a second
      // one for the same commit, which would draw two lines to one node.
      if (!open.includes(parent)) claim(parent);
    }

    const edges: GraphEdge[] = [];
    for (let i = 0; i < before.length; i++) {
      const hash = before[i];
      if (hash === null) continue;
      if (hash === commit.hash) {
        // This lane ends at this commit — it arrives at the node.
        edges.push({ from: i, to: lane, fromNode: false });
      } else {
        // Unrelated lane passing straight through, possibly shifted if it moved.
        const now = open.indexOf(hash);
        edges.push({ from: i, to: now === -1 ? i : now, fromNode: false });
      }
    }
    // Lines leaving this commit toward its parents.
    for (const parent of commit.parents) {
      const to = open.indexOf(parent);
      if (to !== -1) edges.push({ from: lane, to, fromNode: true });
    }

    rows.push({ commit, lane, edges });

    // Trim trailing closed lanes so the gutter shrinks back after a branch ends.
    while (open.length > 0 && open[open.length - 1] === null) open.pop();
  }

  return rows;
}
