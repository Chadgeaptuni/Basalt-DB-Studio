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

export interface DelimitedOptions {
  delimiter: string;
  header: boolean;
  /** How a NULL reads: "" (the TSV default) or a literal like "NULL". */
  nullText: string;
}

/** Quoted RFC 4180-style only when it has to be: the field holds the delimiter,
 *  a quote or a line break. Anything else goes out exactly as displayed. */
function field(text: string, delimiter: string): string {
  return text.includes(delimiter) || /["\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Rows (and optionally the column names) as delimited text, for Copy as…. */
export function toDelimited(names: string[], matrix: CellValue[][], opts: DelimitedOptions): string {
  const line = (cells: string[]) => cells.map((c) => field(c, opts.delimiter)).join(opts.delimiter);
  const lines = matrix.map((row) =>
    line(row.map((v) => (v.kind === "null" ? opts.nullText : formatCell(v).text))),
  );
  if (opts.header) lines.unshift(line(names));
  return lines.join("\n");
}
