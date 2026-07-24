import type { BrowseResult, CellChange, CellValue, GridEdit } from "$lib/api/types";

// Pure staging logic for the editable table-data view — kept out of the rune store
// so it is unit-testable. `edits` maps rowIndex → colIndex → new value; `deletes`
// marks existing rows; `inserts` are new rows (colIndex → value).

export interface InsertRow {
  cells: Record<number, CellValue>;
}
export type CellEdits = Record<number, Record<number, CellValue>>;
export type RowDeletes = Record<number, true>;

const NULL: CellValue = { kind: "null" };

export function cellEq(a: CellValue, b: CellValue): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Parses raw editor text into a CellValue of the original cell's kind, so a
 *  MySQL bool round-trips as Bool (1/0), not the string "true". Unparseable
 *  numbers fall back to Text (the engine reports the real error on commit). */
export function parseCell(raw: string, kind: CellValue["kind"]): CellValue {
  switch (kind) {
    case "bool": {
      const t = raw.trim().toLowerCase();
      if (["true", "1", "t", "yes"].includes(t)) return { kind: "bool", value: true };
      if (["false", "0", "f", "no"].includes(t)) return { kind: "bool", value: false };
      return { kind: "text", value: raw };
    }
    case "int": {
      const n = Number(raw);
      return Number.isInteger(n) ? { kind: "int", value: n } : { kind: "text", value: raw };
    }
    case "float": {
      const n = Number(raw);
      return Number.isFinite(n) ? { kind: "float", value: n } : { kind: "text", value: raw };
    }
    case "decimal":
      return { kind: "decimal", value: raw };
    case "date":
      return { kind: "date", value: raw };
    case "time":
      return { kind: "time", value: raw };
    case "dateTime":
      return { kind: "dateTime", value: raw };
    default:
      // text / json / array / null-origin: send as text (pg casts, others coerce).
      return { kind: "text", value: raw };
  }
}

function keyValues(browse: BrowseResult, rowIndex: number): CellValue[] {
  return browse.keyColumns.map((name) => {
    const col = browse.columns.findIndex((c) => c.name === name);
    return browse.rows[rowIndex][col] ?? NULL;
  });
}

/** Translates staged state into the ordered edit batch the backend commits. */
export function buildEdits(
  browse: BrowseResult,
  edits: CellEdits,
  deletes: RowDeletes,
  inserts: InsertRow[],
): GridEdit[] {
  const out: GridEdit[] = [];
  const colName = (i: number): string => browse.columns[i].name;

  for (const [rowStr, cols] of Object.entries(edits)) {
    const rowIndex = Number(rowStr);
    if (deletes[rowIndex]) continue; // a deleted row's edits are moot
    const set: CellChange[] = Object.entries(cols).map(([c, value]) => ({
      column: colName(Number(c)),
      value,
    }));
    if (set.length > 0) out.push({ op: "update", key: keyValues(browse, rowIndex), set });
  }
  for (const rowStr of Object.keys(deletes)) {
    out.push({ op: "delete", key: keyValues(browse, Number(rowStr)) });
  }
  for (const ins of inserts) {
    const set: CellChange[] = Object.entries(ins.cells).map(([c, value]) => ({
      column: colName(Number(c)),
      value,
    }));
    if (set.length > 0) out.push({ op: "insert", set });
  }
  return out;
}

export function pendingCount(edits: CellEdits, deletes: RowDeletes, inserts: InsertRow[]): number {
  const cells = Object.values(edits).reduce((n, cols) => n + Object.keys(cols).length, 0);
  const newRows = inserts.filter((i) => Object.keys(i.cells).length > 0).length;
  return cells + Object.keys(deletes).length + newRows;
}

export function deleteCount(deletes: RowDeletes): number {
  return Object.keys(deletes).length;
}
