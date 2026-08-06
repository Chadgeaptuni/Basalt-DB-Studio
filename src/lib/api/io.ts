import { Channel } from "@tauri-apps/api/core";
import { invoke } from "./client";
import type { ConflictMode, ExportFormat, ExportProgress, ImportResult } from "./types";

// The export commands require a progress channel, but no caller renders progress
// yet. Building the sink here keeps @tauri-apps out of the component layer
// (DESIGN §9) — callers pass a path, not IPC plumbing.
const progressSink = (): Channel<ExportProgress> => new Channel<ExportProgress>();

// Import/export commands — the ONLY invoke site for this domain. Export streams
// progress over an ipc::Channel; the returned number is the total row count.
export const ioApi = {
  exportQuery: (sessionId: string, sql: string, format: ExportFormat, path: string) =>
    invoke<number>("export_query", { sessionId, sql, format, path, onProgress: progressSink() }),

  exportTable: (
    sessionId: string,
    namespace: string,
    table: string,
    format: ExportFormat,
    path: string,
  ) =>
    invoke<number>("export_table", {
      sessionId,
      namespace,
      table,
      format,
      path,
      onProgress: progressSink(),
    }),

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
