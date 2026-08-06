import { gitsyncApi, type GitStatus } from "$lib/api/gitsync";
import type { ApiError } from "$lib/api/client";
import { toast } from "./toasts.svelte";
import { connections } from "./connections.svelte";
import { savedQueries } from "./savedQueries.svelte";

// Git-sync state for the Git panel. `status` drives the readout; `sync()` runs
// the manual push/pull and, on success, reloads the two synced units (profiles +
// saved queries) so a pull's incoming changes appear without a restart. Error
// kinds (gitConflict / gitNotInstalled / gitDirty) are held for inline display.

let status = $state<GitStatus | null>(null);
let syncing = $state(false);
let error = $state<ApiError | null>(null);

async function refresh(): Promise<void> {
  try {
    status = await gitsyncApi.status();
  } catch (e) {
    error = e as ApiError;
  }
}

function summarize(o: { committed: boolean; pulled: boolean; pushed: boolean }): string {
  const parts: string[] = [];
  if (o.committed) parts.push("committed");
  if (o.pulled) parts.push("pulled");
  if (o.pushed) parts.push("pushed");
  return parts.length ? `Sync: ${parts.join(", ")}` : "Already up to date";
}

export const gitsync = {
  get status() {
    return status;
  },
  get syncing() {
    return syncing;
  },
  get error() {
    return error;
  },
  refresh,
  async sync(): Promise<void> {
    syncing = true;
    error = null;
    try {
      const outcome = await gitsyncApi.sync();
      toast.success(summarize(outcome));
      // A pull may have brought in new profiles/queries — reload both units.
      await Promise.all([connections.load(), savedQueries.load()]);
    } catch (e) {
      error = e as ApiError;
      if ((e as ApiError).kind === "internal") toast.error((e as ApiError).message);
    } finally {
      syncing = false;
      await refresh();
    }
  },
};
