import { invoke } from "./client";
import type { BrowseResult, GridCommitResult, GridEdit } from "./types";

// Typed wrappers over the grid commands — the ONLY invoke site for this domain.
export const gridApi = {
  browse: (sessionId: string, namespace: string, table: string, limit?: number) =>
    invoke<BrowseResult>("grid_browse", { sessionId, namespace, table, limit }),

  commit: (
    sessionId: string,
    namespace: string,
    table: string,
    keyColumns: string[],
    edits: GridEdit[],
  ) => invoke<GridCommitResult>("grid_commit", { sessionId, namespace, table, keyColumns, edits }),
};
