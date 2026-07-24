import { invoke } from "./client";
import type { RunResult } from "./types";

// Typed wrapper over the query command. The ONLY invoke site for this domain.
// `cursorOffset` set → run the statement at the cursor; unset → run every
// statement in `sql` (the caller passes selected text for run-selection).
// `confirmed` re-runs past the destructive-statement gate.
export const queryApi = {
  run: (
    sessionId: string,
    sql: string,
    opts: { cursorOffset?: number; confirmed?: boolean; limit?: number } = {},
  ) =>
    invoke<RunResult>("run_query", {
      sessionId,
      sql,
      cursorOffset: opts.cursorOffset,
      confirmed: opts.confirmed ?? false,
      limit: opts.limit,
    }),
};
