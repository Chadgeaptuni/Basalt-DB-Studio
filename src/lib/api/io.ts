import { Channel } from "@tauri-apps/api/core";
import { invoke } from "./client";
import type { ConflictMode, ExportFormat, ExportProgress, ImportResult } from "./types";

// Import/export commands — the ONLY invoke site for this domain. Export streams
// progress over an ipc::Channel; the returned number is the total row count.
export const ioApi = {
  exportQuery: (
    sessionId: string,
    sql: string,
    format: ExportFormat,
    path: string,
    onProgress: Channel<ExportProgress>,
  ) => invoke<number>("export_query", { sessionId, sql, format, path, onProgress }),

  exportTable: (
    sessionId: string,
    namespace: string,
    table: string,
    format: ExportFormat,
    path: string,
    onProgress: Channel<ExportProgress>,
  ) => invoke<number>("export_table", { sessionId, namespace, table, format, path, onProgress }),

  importCsv: (
    sessionId: string,
    namespace: string,
    table: string,
    columns: string[],
    hasHeader: boolean,
    conflict: ConflictMode,
    path: string,
  ) => invoke<ImportResult>("import_csv", { sessionId, namespace, table, columns, hasHeader, conflict, path }),
};
