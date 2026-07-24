import { invoke } from "./client";

// Git-sync commands — the ONLY invoke site for this domain. The config dir is the
// repo; sync is manual (add → commit → pull --rebase → push). Mirrors
// src-tauri/src/gitsync/mod.rs.

/** Snapshot for the sync badge; all-false/zero when git is absent. */
export interface GitStatus {
  installed: boolean;
  isRepo: boolean;
  hasRemote: boolean;
  branch?: string;
  /** Uncommitted/untracked entries. */
  dirty: number;
  ahead: number;
  behind: number;
}

export interface SyncOutcome {
  committed: boolean;
  pulled: boolean;
  pushed: boolean;
}

export const gitsyncApi = {
  status: () => invoke<GitStatus>("git_status"),
  sync: () => invoke<SyncOutcome>("git_sync"),
};
