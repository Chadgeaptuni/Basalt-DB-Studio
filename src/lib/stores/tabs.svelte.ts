import type { RunResult } from "$lib/api/types";
import type { ApiError } from "$lib/api/client";

// Editor tabs (DESIGN §5): each tab owns its SQL draft and the last run's result.
// Session-only; not persisted (saved queries are a separate M6 concern). Mutations
// go through the returned proxy objects — Svelte 5 `$state` is deeply reactive.

export interface EditorTab {
  id: string;
  title: string;
  sql: string;
  /** Last run's per-statement results, or null before the first run. */
  result: RunResult | null;
  running: boolean;
  /** Run-level failure (read-only violation, lost connection…) shown in results. */
  runError: ApiError | null;
  /** Which statement's result tab is selected. */
  activeStatement: number;
  /** Epoch ms the current run started, for the elapsed-time display. */
  runStartedAt: number | null;
}

let tabs = $state<EditorTab[]>([]);
let activeId = $state<string | null>(null);
let seq = 0;

function find(id: string): EditorTab | undefined {
  return tabs.find((t) => t.id === id);
}

function open(sql = ""): string {
  const id = `tab-${++seq}`;
  tabs.push({
    id,
    title: `Query ${seq}`,
    sql,
    result: null,
    running: false,
    runError: null,
    activeStatement: 0,
    runStartedAt: null,
  });
  activeId = id;
  return id;
}

function close(id: string): void {
  const i = tabs.findIndex((t) => t.id === id);
  if (i === -1) return;
  tabs.splice(i, 1);
  if (activeId === id) activeId = tabs[Math.min(i, tabs.length - 1)]?.id ?? null;
}

function select(id: string): void {
  if (find(id)) activeId = id;
}

export const editorTabs = {
  get list() {
    return tabs;
  },
  get active() {
    return activeId ? (find(activeId) ?? null) : null;
  },
  open,
  close,
  select,
  find,
};
