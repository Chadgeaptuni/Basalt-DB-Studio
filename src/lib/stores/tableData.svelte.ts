import { gridApi } from "$lib/api/grid";
import type { ApiError } from "$lib/api/client";
import type { BrowseResult, CellValue } from "$lib/api/types";
import {
  buildEdits,
  cellEq,
  pendingCount,
  deleteCount,
  type CellEdits,
  type InsertRow,
  type RowDeletes,
} from "$lib/components/grid/tableEdits";

// Per-editor-tab table-data state: the browsed page plus staged edits. Staging
// survives tab switches (keyed by tab id) and is applied optimistically in the
// grid; the backend commit is one transaction, so a failure keeps the staging
// and surfaces the error (nothing was written).

interface State {
  namespace: string;
  table: string;
  loading: boolean;
  error: ApiError | null;
  browse: BrowseResult | null;
  edits: CellEdits;
  deletes: RowDeletes;
  inserts: InsertRow[];
  committing: boolean;
  commitError: ApiError | null;
}

let byTab = $state<Record<string, State>>({});

function fresh(namespace: string, table: string): State {
  return {
    namespace,
    table,
    loading: true,
    error: null,
    browse: null,
    edits: {},
    deletes: {},
    inserts: [],
    committing: false,
    commitError: null,
  };
}

async function load(tabId: string, sessionId: string, namespace: string, table: string): Promise<void> {
  byTab[tabId] = fresh(namespace, table);
  try {
    const browse = await gridApi.browse(sessionId, namespace, table);
    const s = byTab[tabId];
    if (s) {
      s.browse = browse;
      s.loading = false;
    }
  } catch (e) {
    const s = byTab[tabId];
    if (s) {
      s.error = e as ApiError;
      s.loading = false;
    }
  }
}

function setCell(tabId: string, rowIndex: number, colIndex: number, value: CellValue): void {
  const s = byTab[tabId];
  if (!s || !s.browse) return;
  const orig = s.browse.rows[rowIndex]?.[colIndex];
  // Editing a cell back to its original clears the pending edit.
  if (orig && cellEq(orig, value)) {
    if (s.edits[rowIndex]) {
      delete s.edits[rowIndex][colIndex];
      if (Object.keys(s.edits[rowIndex]).length === 0) delete s.edits[rowIndex];
    }
    return;
  }
  if (!s.edits[rowIndex]) s.edits[rowIndex] = {};
  s.edits[rowIndex][colIndex] = value;
}

function toggleDelete(tabId: string, rowIndex: number): void {
  const s = byTab[tabId];
  if (!s) return;
  if (s.deletes[rowIndex]) delete s.deletes[rowIndex];
  else s.deletes[rowIndex] = true;
}

function addRow(tabId: string): void {
  byTab[tabId]?.inserts.push({ cells: {} });
}

function setInsertCell(tabId: string, insertIndex: number, colIndex: number, value: CellValue): void {
  const row = byTab[tabId]?.inserts[insertIndex];
  if (row) row.cells[colIndex] = value;
}

function removeInsert(tabId: string, insertIndex: number): void {
  byTab[tabId]?.inserts.splice(insertIndex, 1);
}

function revert(tabId: string): void {
  const s = byTab[tabId];
  if (!s) return;
  s.edits = {};
  s.deletes = {};
  s.inserts = [];
  s.commitError = null;
}

async function commit(tabId: string, sessionId: string): Promise<void> {
  const s = byTab[tabId];
  if (!s || !s.browse) return;
  const edits = buildEdits(s.browse, s.edits, s.deletes, s.inserts);
  if (edits.length === 0) return;
  s.committing = true;
  s.commitError = null;
  try {
    await gridApi.commit(sessionId, s.namespace, s.table, s.browse.keyColumns, edits);
    // Success → reload the authoritative page (also clears staging).
    await load(tabId, sessionId, s.namespace, s.table);
  } catch (e) {
    const cur = byTab[tabId];
    if (cur) {
      cur.commitError = e as ApiError;
      cur.committing = false;
    }
  }
}

function dispose(tabId: string): void {
  delete byTab[tabId];
}

export const tableData = {
  get: (tabId: string): State | undefined => byTab[tabId],
  isDeleted: (tabId: string, rowIndex: number): boolean => Boolean(byTab[tabId]?.deletes[rowIndex]),
  pending: (tabId: string): number => {
    const s = byTab[tabId];
    return s ? pendingCount(s.edits, s.deletes, s.inserts) : 0;
  },
  deletes: (tabId: string): number => {
    const s = byTab[tabId];
    return s ? deleteCount(s.deletes) : 0;
  },
  load,
  setCell,
  toggleDelete,
  addRow,
  setInsertCell,
  removeInsert,
  revert,
  commit,
  dispose,
};
