import { savedQueriesApi, type SavedQuery } from "$lib/api/savedQueries";
import type { ApiError } from "$lib/api/client";
import { editorTabs } from "./tabs.svelte";

// The saved-query tree. Flat list of folder-relative paths; the panel groups
// them by folder for display. Mutations refresh the list so the panel always
// shows what is on disk.

let items = $state<SavedQuery[]>([]);
let loading = $state(false);
let error = $state<ApiError | null>(null);

async function load(): Promise<void> {
  loading = true;
  try {
    items = await savedQueriesApi.list();
    error = null;
  } catch (e) {
    error = e as ApiError;
  } finally {
    loading = false;
  }
}

export const savedQueries = {
  get items() {
    return items;
  },
  get loading() {
    return loading;
  },
  get error() {
    return error;
  },
  load,
  read: (path: string) => savedQueriesApi.read(path),
  async save(path: string, sql: string): Promise<void> {
    await savedQueriesApi.save(path, sql);
    await load();
  },
  async remove(path: string): Promise<void> {
    await savedQueriesApi.remove(path);
    await load();
  },
  /** Renames or moves a query; tabs bound to it follow, so Ctrl+S keeps
   *  saving to where the query now is. */
  async rename(from: string, to: string): Promise<void> {
    await savedQueriesApi.rename(from, to);
    const name = to.slice(to.lastIndexOf("/") + 1);
    for (const tab of editorTabs.list) {
      if (tab.savedPath === from) editorTabs.markSaved(tab.id, to, name);
    }
    await load();
  },
};
