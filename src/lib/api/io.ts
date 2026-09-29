import { Channel } from "@tauri-apps/api/core";
import { invoke } from "./client";
import type { ConflictMode, ExportFormat, ExportProgress, ImportResult } from "./types";

// Progress arrives over an ipc::Channel. Building it here keeps @tauri-apps out of
// the component layer (DESIGN §9): callers pass a callback, not IPC plumbing.
export type OnRows = (rows: number) => void;

function channel<T>(read: (message: T) => number, onRows?: OnRows): Channel<T> {
  const c = new Channel<T>();
  if (onRows) c.onmessage = (message) => onRows(read(message));
  return c;
}
const exportChannel = (onRows?: OnRows) => channel<ExportProgress>((p) => p.rows, onRows);

// Import/export commands — the ONLY invoke site for this domain. The returned
// number is the total row count.
export const ioApi = {
  exportQuery: (sessionId: string, sql: string, format: ExportFormat, path: string, onRows?: OnRows) =>
    invoke<number>("export_query", { sessionId, sql, format, path, onProgress: exportChannel(onRows) }),

  exportTable: (
    sessionId: string,
    namespace: string,
    table: string,
    format: ExportFormat,
    path: string,
    onRows?: OnRows,
  ) =>
    invoke<number>("export_table", {
      sessionId,
      namespace,
      table,
      format,
      path,
      onProgress: exportChannel(onRows),
    }),

  /** The CSV's first record, for mapping its fields to columns. */
  csvHeader: (path: string) => invoke<string[]>("csv_header", { path }),

  /** `mapping[i]` is the column CSV field `i` goes to; null skips it. */
  importCsv: (
    sessionId: string,
    namespace: string,
    table: string,
    mapping: (string | null)[],
    hasHeader: boolean,
    conflict: ConflictMode,
    path: string,
    onRows?: OnRows,
  ) =>
    invoke<ImportResult>("import_csv", {
      sessionId,
      namespace,
      table,
      mapping,
      hasHeader,
      conflict,
      path,
      onProgress: channel<number>((n) => n, onRows),
    }),
};
