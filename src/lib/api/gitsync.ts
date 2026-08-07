import { invoke } from "./client";

// Git commands — the ONLY invoke site for this domain. The repo is the config
// dir. Mirrors src-tauri/src/gitsync/.
//
// Authentication is the system's, not ours: git's own credential helper and ssh
// agent answer the remote, so nothing here takes a token and the app stores none.
// What the backend guarantees instead is that a credential failure arrives as
// `gitAuthFailed` rather than as raw stderr.

export type FileState =
  | "added"
  | "modified"
  | "deleted"
  | "renamed"
  | "untracked"
  | "conflicted";

export interface FileEntry {
  path: string;
  state: FileState;
}

export interface GitStatus {
  installed: boolean;
  isRepo: boolean;
  hasRemote: boolean;
  branch?: string;
  /** `origin/main` — absent on a branch that has never been pushed. */
  upstream?: string;
  ahead: number;
  behind: number;
  staged: FileEntry[];
  unstaged: FileEntry[];
  conflicted: FileEntry[];
  /** A half-finished rebase or merge; every action is refused while true. */
  inProgress: boolean;
}

export interface SyncOutcome {
  committed: boolean;
  pulled: boolean;
  pushed: boolean;
}

export interface Branch {
  name: string;
  current: boolean;
  remote: boolean;
}

export interface Commit {
  hash: string;
  short: string;
  /** Two or more means a merge; zero means the root. */
  parents: string[];
  author: string;
  email: string;
  /** ISO-8601 with offset. */
  date: string;
  subject: string;
  refs: string[];
}

/** Whether the GitHub CLI can create a repo on the user's behalf. */
export interface GithubStatus {
  installed: boolean;
  /** `gh auth status` succeeded — gh holds a usable token of its own. */
  authenticated: boolean;
  /** The account gh is signed in as, so the panel can name it before creating. */
  login?: string;
}

export const gitsyncApi = {
  status: () => invoke<GitStatus>("git_status"),
  /** The one-button flow: stage all → commit → pull --rebase → push. */
  sync: () => invoke<SyncOutcome>("git_sync"),

  stage: (paths: string[]) => invoke<void>("git_stage", { paths }),
  unstage: (paths: string[]) => invoke<void>("git_unstage", { paths }),
  /** Destructive and unrecoverable — call `confirm()` first. */
  discard: (paths: string[]) => invoke<void>("git_discard", { paths }),
  commit: (message: string) => invoke<void>("git_commit", { message }),

  fetch: () => invoke<void>("git_fetch"),
  pull: () => invoke<void>("git_pull"),
  push: () => invoke<void>("git_push"),

  branches: () => invoke<Branch[]>("git_branches"),
  checkout: (name: string) => invoke<void>("git_checkout", { name }),
  createBranch: (name: string) => invoke<void>("git_create_branch", { name }),

  history: (limit: number) => invoke<Commit[]>("git_history", { limit }),
  commitFiles: (hash: string) => invoke<FileEntry[]>("git_commit_files", { hash }),
  commitDiff: (hash: string, path: string) => invoke<string>("git_commit_diff", { hash, path }),
  fileDiff: (path: string, staged: boolean) => invoke<string>("git_file_diff", { path, staged }),

  init: () => invoke<void>("git_init"),
  setRemote: (url: string) => invoke<void>("git_set_remote", { url }),

  // Creating the repo needs a GitHub *account*, which git has none of. `gh` has
  // one, in its own keychain entry — so this borrows gh's sign-in the same way
  // push borrows the credential helper's, and Basalt still stores no token.
  githubStatus: () => invoke<GithubStatus>("github_status"),
  githubPublish: (name: string) => invoke<void>("github_publish", { name }),
};
