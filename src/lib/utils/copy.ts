import type { CellValue } from "$lib/api/types";
import { formatCell } from "./cellDisplay";

// The single copy path (DESIGN §7 / spec: no per-call-site copy logic). TSV with
// NULL rendered as empty (never the literal "NULL").
export function cellToTsv(v: CellValue): string {
  return v.kind === "null" ? "" : formatCell(v).text;
}

/** The single clipboard write. Everything that copies goes through here. */
export async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

/** Copies a cell matrix as TSV to the clipboard (headerless, NULL → empty). */
export async function copyCellsTsv(matrix: CellValue[][]): Promise<void> {
  await copyText(matrix.map((row) => row.map(cellToTsv).join("\t")).join("\n"));
}
