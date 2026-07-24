import { invoke } from "./client";
import type { SchemaTree, TableDescription } from "./types";

export const introspectApi = {
  tree: (sessionId: string) => invoke<SchemaTree>("introspect", { sessionId }),
  describeTable: (sessionId: string, namespace: string, table: string) =>
    invoke<TableDescription>("describe_table", { sessionId, namespace, table }),
};
