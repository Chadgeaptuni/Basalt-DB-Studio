import { gitsyncApi, type Branch, type GitStatus } from "$lib/api/gitsync";
import type { ApiError } from "$lib/api/client";
import { toast } from "./toasts.svelte";
import { connections } from "./connections.svelte";
import { savedQueries } from "./savedQueries.svelte";

// Git state for the Git panel and the history view.
//
// Two rules run through everything here.
//
// Errors are *held*, not toasted. The panel renders every kind inline with the
// action that fixes it (DESIGN §8), and a toast saying the same thing at the same
// moment is the app repeating itself. The one exception is an action that opens a
// dialog over the panel, where the inline state would be behind it.
//
// Anything that can change files on disk reloads the two synced units afterwards.
// Pull, checkout, discard and sync all rewrite the working tree, and a profile
// list still showing what was there before a pull is worse than a slow refresh.

let status = $state<GitStatus | null>(null);
let branches = $state<Branch[]>([]);
let error = $state<ApiError | null>(null);
/** Name of the operation in flight, so each control disables only itself. */
let busy = $state<string | null>(null);

async function refresh(): Promise<void> {
  try {
    status = await gitsyncApi.status();
    if (status.isRepo) branches = await gitsyncApi.branches();
  } catch (e) {
    error = e as ApiError;
  }
}

/** The working tree changed under us — re-read what the config dir feeds. */
async function reloadWorkingTree(): Promise<void> {
  await Promise.all([connections.load(), savedQueries.load()]);
}

/**
 * Run one git action: clear the last error, mark what is in flight, refresh
 * afterwards whatever happened. Every action below is this shape, and writing it
 * out thirteen times is how one of them ends up not refreshing.
 */
async function act(
  name: string,
  run: () => Promise<void>,
  opts: { reload?: boolean; done?: string } = {},
): Promise<boolean> {
  busy = name;
  error = null;
  try {
    await run();
    if (opts.reload) await reloadWorkingTree();
    if (opts.done) toast.success(opts.done);
    return true;
  } catch (e) {
    error = e as ApiError;
    return false;
  } finally {
    busy = null;
    await refresh();
  }
}

function summarize(o: { committed: boolean; pulled: boolean; pushed: boolean }): string {
  const parts = [
    o.committed && "committed",
    o.pulled && "pulled",
    o.pushed && "pushed",
  ].filter(Boolean);
  return parts.length ? `Sync: ${parts.join(", ")}` : "Already up to date";
}

export const gitsync = {
  get status() {
    return status;
  },
  get branches() {
    return branches;
  },
  get error() {
    return error;
  },
  get busy() {
    return busy;
  },
  /** True while any action runs — for the controls that must all lock together. */
  get working() {
    return busy !== null;
  },

  refresh,
  clearError: () => (error = null),

  stage: (paths: string[]) => act("stage", () => gitsyncApi.stage(paths)),
  unstage: (paths: string[]) => act("unstage", () => gitsyncApi.unstage(paths)),
  /** Destructive: the caller confirms first. Reloads — files change on disk. */
  discard: (paths: string[]) =>
    act("discard", () => gitsyncApi.discard(paths), { reload: true }),

  commit: (message: string) => act("commit", () => gitsyncApi.commit(message)),

  fetch: () => act("fetch", () => gitsyncApi.fetch()),
  pull: () => act("pull", () => gitsyncApi.pull(), { reload: true, done: "Pulled" }),
  push: () => act("push", () => gitsyncApi.push(), { done: "Pushed" }),

  checkout: (name: string) =>
    act("checkout", () => gitsyncApi.checkout(name), { reload: true }),
  createBranch: (name: string) =>
    act("createBranch", () => gitsyncApi.createBranch(name), { reload: true }),

  init: () => act("init", () => gitsyncApi.init()),
  setRemote: (url: string) => act("setRemote", () => gitsyncApi.setRemote(url)),

  async sync(): Promise<boolean> {
    busy = "sync";
    error = null;
    try {
      toast.success(summarize(await gitsyncApi.sync()));
      await reloadWorkingTree();
      return true;
    } catch (e) {
      error = e as ApiError;
      return false;
    } finally {
      busy = null;
      await refresh();
    }
  },
};
