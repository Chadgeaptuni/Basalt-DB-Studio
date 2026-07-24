import { invoke } from "./client";

// Saved-query commands — the ONLY invoke site for this domain. A query is a
// `.sql` file under nestable folders; `path` is folder-relative, no extension.
// Mirrors src-tauri/src/config/saved_queries.rs.

export interface SavedQuery {
  path: string;
  name: string;
}

export const savedQueriesApi = {
  list: () => invoke<SavedQuery[]>("list_saved_queries"),
  read: (path: string) => invoke<string>("read_saved_query", { path }),
  save: (path: string, sql: string) => invoke<void>("save_query", { path, sql }),
  remove: (path: string) => invoke<void>("delete_saved_query", { path }),
};
