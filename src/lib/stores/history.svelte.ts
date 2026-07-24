import type { Engine } from "$lib/api/types";

// Session-only query history (spec: no backend history subsystem). One entry per
// run; newest first; capped so it never grows unbounded. Click-to-reload opens the
// SQL in a fresh editor tab.

export interface HistoryEntry {
  id: string;
  sql: string;
  engine: Engine;
  ok: boolean;
  /** Total rows returned across the run's statements, or null for non-SELECT. */
  rowCount: number | null;
  durationMs: number;
  ranAt: number;
}

const CAP = 200;
let entries = $state<HistoryEntry[]>([]);
let seq = 0;

function push(e: Omit<HistoryEntry, "id" | "ranAt">): void {
  entries.unshift({ ...e, id: `h-${++seq}`, ranAt: Date.now() });
  if (entries.length > CAP) entries.length = CAP;
}

function clear(): void {
  entries = [];
}

export const history = {
  get list() {
    return entries;
  },
  push,
  clear,
};
