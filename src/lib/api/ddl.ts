import { invoke } from "./client";
import type { DdlRequest } from "./types";

// Generates the engine SQL for a DDL request (shown in the preview modal). The
// generated SQL is executed through the normal run_query path.
export const ddlApi = {
  generate: (sessionId: string, request: DdlRequest) =>
    invoke<string>("ddl_generate", { sessionId, request }),
};
