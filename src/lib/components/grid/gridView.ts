import type { CellValue } from "$lib/api/types";

// Per-grid view state: which column sorts, which columns are hidden. It is *view*
// state only — no SQL is generated and nothing is re-fetched.
//
// The honest limitation, surfaced in the UI rather than buried here: `grid_browse`
// and the query runner both return a row-limited page, and sorting reorders the
// rows we have. When a result is truncated the sort chip says so, because "sorted
// by amount desc" over the first 1000 of 100k rows does not show you the largest
// amount, and a tool that implies otherwise is worse than one that can't sort.

export type SortDir = "asc" | "desc";

export interface SortState {
  column: number;
  dir: SortDir;
}

/** Compare two non-NULL cells of the same column. NULLs are handled by the caller,
 *  which must pin them outside the direction flip. */
function compare(a: CellValue, b: CellValue): number {
  if ((a.kind === "int" || a.kind === "float") && (b.kind === "int" || b.kind === "float")) {
    return a.value - b.value;
  }
  if (a.kind === "bool" && b.kind === "bool") return Number(a.value) - Number(b.value);
  if (a.kind === "decimal" && b.kind === "decimal") {
    const na = Number(a.value);
    const nb = Number(b.value);
    // Decimals can exceed a double; fall back to string order rather than lie.
    if (Number.isFinite(na) && Number.isFinite(nb) && String(na) === a.value && String(nb) === b.value) {
      return na - nb;
    }
    return a.value.localeCompare(b.value);
  }

  const sa = sortKey(a);
  const sb = sortKey(b);
  return sa.localeCompare(sb, undefined, { numeric: true, sensitivity: "base" });
}

function sortKey(v: CellValue): string {
  switch (v.kind) {
    case "text":
    case "date":
    case "time":
    case "dateTime":
    case "decimal":
      return v.value;
    case "int":
    case "float":
      return String(v.value);
    case "bool":
      return v.value ? "1" : "0";
    case "json":
      return JSON.stringify(v.value);
    case "bytes":
      return v.value.preview;
    case "array":
      return v.value.map(sortKey).join(",");
    case "unknown":
      return v.value.display || v.value.typeName;
    case "null":
      return "";
  }
}

/**
 * Row indices in display order. Returns indices rather than reordered rows so the
 * caller keeps every row's original position — the grid's edit staging identifies
 * rows by index, and handing it shuffled rows would commit edits to the wrong ones.
 */
export function sortedOrder(rows: CellValue[][], sort: SortState | null): number[] {
  const order = rows.map((_, i) => i);
  if (!sort) return order;
  const sign = sort.dir === "asc" ? 1 : -1;
  return order.sort((ia, ib) => {
    const a = rows[ia]?.[sort.column];
    const b = rows[ib]?.[sort.column];
    if (!a || !b) return 0;

    // NULLs are pinned last *before* the direction flip. They are absence, not a
    // smallest value — letting `desc` float them to the top would bury the rows
    // the user asked to see behind a block of blanks.
    const aNull = a.kind === "null";
    const bNull = b.kind === "null";
    if (aNull || bNull) return aNull && bNull ? ia - ib : aNull ? 1 : -1;

    const c = compare(a, b);
    // Ties keep their original order, so a sort never scrambles equal rows.
    return c === 0 ? ia - ib : c * sign;
  });
}
