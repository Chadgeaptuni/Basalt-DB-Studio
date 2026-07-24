import type { CellValue } from "$lib/api/types";
import { formatCell } from "./cellDisplay";

// The single copy path (DESIGN §7 / spec: no per-call-site copy logic). TSV with
// NULL rendered as empty (never the literal "NULL").
export function cellToTsv(v: CellValue): string {
  return v.kind === "null" ? "" : formatCell(v).text;
}

/** Copies a cell matrix as TSV to the clipboard (headerless, NULL → empty). */
export async function copyCellsTsv(matrix: CellValue[][]): Promise<void> {
  const tsv = matrix.map((row) => row.map(cellToTsv).join("\t")).join("\n");
  await navigator.clipboard.writeText(tsv);
}
