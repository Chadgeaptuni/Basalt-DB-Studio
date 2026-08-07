//! Git for the config directory — the repo the app owns (profiles + saved
//! queries). We shell out to **system git** (no `git2`/`gix` — bundle weight;
//! target users have git), which also means the user's own credential helper,
//! SSH agent and `.gitconfig` apply unchanged. Nothing here imports `tauri`;
//! commands call it on a blocking thread.
//!
//! Authentication is deliberately not ours. Git Credential Manager already does
//! GitHub OAuth on Windows and macOS, and an ssh agent covers the rest, so the
//! app stores no token and needs no secret storage for git. What it owes the user
//! is a *specific* failure when that machinery has nothing to offer, which is
//! what `remote_error` below is for.

mod diff;
mod history;
mod ops;
mod status;

pub use diff::{commit_files, diff_commit_file, diff_worktree_file};
pub use history::{history, Commit};
pub use ops::{
    branches, checkout, commit, create_branch, discard, fetch, init, pull, push, set_remote, stage,
    sync, unstage, Branch, SyncOutcome,
};
pub use status::{status, FileEntry, FileState, GitStatus};

use std::path::Path;
use std::process::{Command, Output, Stdio};

use crate::{AppError, AppResult};

/// Every git invocation in the app goes through here.
///
/// `GIT_TERMINAL_PROMPT=0` is the load-bearing part. Launched from a GUI there is
/// no terminal to answer on, so a remote that wants a username would otherwise
/// leave git blocked on a read that can never complete — the app would hang
/// rather than fail, with no way back. With prompts off git returns a failure we
/// can classify. GUI helpers are untouched and still answer: this disables the
/// *terminal* prompt, not `GIT_ASKPASS` or the credential helper.
///
/// `LC_ALL=C` because `remote_error` reads git's own English wording; without it
/// a localized git would defeat every match and every failure would collapse to
/// `internal`.
pub(crate) fn git(dir: &Path, args: &[&str]) -> AppResult<Output> {
    Command::new("git")
        .arg("-C")
        .arg(dir)
        .args(args)
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("LC_ALL", "C")
        .stdin(Stdio::null())
        .output()
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                AppError::GitNotInstalled("git is not installed or not on PATH".into())
            } else {
                AppError::internal(e)
            }
        })
}

pub(crate) fn stdout(o: &Output) -> String {
    String::from_utf8_lossy(&o.stdout).trim().to_string()
}

pub(crate) fn stderr(o: &Output) -> String {
    String::from_utf8_lossy(&o.stderr).trim().to_string()
}

pub(crate) fn available() -> bool {
    Command::new("git")
        .arg("--version")
        .stdin(Stdio::null())
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// Guard for anything that touches a repo. Separated from the callers so the two
/// preconditions are stated once and worded once.
pub(crate) fn require_repo(dir: &Path) -> AppResult<()> {
    if !available() {
        return Err(AppError::GitNotInstalled(
            "git is not installed or not on PATH".into(),
        ));
    }
    if !dir.exists() || !is_repo(dir)? {
        return Err(AppError::internal(
            "the config directory is not a git repository",
        ));
    }
    Ok(())
}

pub(crate) fn is_repo(dir: &Path) -> AppResult<bool> {
    Ok(stdout(&git(dir, &["rev-parse", "--is-inside-work-tree"])?) == "true")
}

pub(crate) fn rebase_or_merge_in_progress(dir: &Path) -> bool {
    let g = dir.join(".git");
    g.join("rebase-merge").exists() || g.join("rebase-apply").exists() || g.join("MERGE_HEAD").exists()
}

/// Substrings that mean "git had no usable credentials, or the remote refused
/// them". Matched case-insensitively against stderr.
///
/// `repository not found` is in here on purpose: GitHub returns 404 rather than
/// 403 for a private repo you cannot see, deliberately conflating "missing" with
/// "not yours". Telling the user it might be either beats asserting the wrong one.
const AUTH_MARKERS: &[&str] = &[
    "authentication failed",
    "could not read username",
    "could not read password",
    "invalid username or password",
    "permission denied (publickey)",
    "terminal prompts disabled",
    "support for password authentication was removed",
    "repository not found",
    "403 forbidden",
    "access denied",
];

/// Substrings that mean the push lost a race — the remote moved on. Recoverable
/// by pulling, with no conflict resolution needed unless the rebase says so.
const REJECTED_MARKERS: &[&str] = &[
    "non-fast-forward",
    "fetch first",
    "updates were rejected",
    "behind its remote counterpart",
];

/// Map a failed remote operation onto the kind whose remedy actually applies.
/// Anything unrecognised stays `internal` carrying git's own words — a wrong
/// specific diagnosis is worse than an honest generic one.
pub(crate) fn remote_error(op: &str, raw: &str) -> AppError {
    let lower = raw.to_lowercase();

    if AUTH_MARKERS.iter().any(|m| lower.contains(m)) {
        return AppError::GitAuthFailed(if lower.contains("repository not found") {
            "the remote rejected this clone: the repository does not exist, or your credentials \
             do not have access to it"
                .into()
        } else {
            "git could not authenticate with the remote".into()
        });
    }

    if REJECTED_MARKERS.iter().any(|m| lower.contains(m)) {
        return AppError::GitPushRejected(
            "the remote has commits this copy does not — pull, then push again".into(),
        );
    }

    AppError::internal(format!("git {op} failed: {raw}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn status_of_non_repo_reports_installed_not_repo() {
        let dir = std::env::temp_dir().join(format!("basalt-git-{}", uuid::Uuid::new_v4()));
        let st = status(&dir).unwrap();
        assert!(st.installed, "git should be installed in the test env");
        assert!(!st.is_repo);
        assert!(!st.has_remote);
    }

    #[test]
    fn classifies_missing_credentials_as_auth() {
        let e = remote_error("push", "fatal: Authentication failed for 'https://…'");
        assert_eq!(e.kind(), "gitAuthFailed");
    }

    // The case that actually bites a GUI: no terminal to prompt on.
    #[test]
    fn classifies_a_blocked_prompt_as_auth() {
        let e = remote_error(
            "pull",
            "fatal: could not read Username for 'https://github.com': terminal prompts disabled",
        );
        assert_eq!(e.kind(), "gitAuthFailed");
    }

    #[test]
    fn classifies_an_ssh_key_refusal_as_auth() {
        let e = remote_error("push", "git@github.com: Permission denied (publickey).");
        assert_eq!(e.kind(), "gitAuthFailed");
    }

    // GitHub 404s a private repo you cannot see, so this has to say "or".
    #[test]
    fn admits_that_repository_not_found_is_ambiguous() {
        let e = remote_error("push", "remote: Repository not found.");
        assert_eq!(e.kind(), "gitAuthFailed");
        assert!(e.to_string().contains("do not have access"));
    }

    #[test]
    fn classifies_a_stale_push_as_rejected_not_conflict() {
        let e = remote_error(
            "push",
            "! [rejected] main -> main (non-fast-forward)\nUpdates were rejected",
        );
        assert_eq!(e.kind(), "gitPushRejected");
    }

    // An unrecognised failure keeps git's own words rather than guessing.
    #[test]
    fn leaves_an_unknown_failure_generic() {
        let e = remote_error("fetch", "fatal: unable to access: SSL certificate problem");
        assert_eq!(e.kind(), "internal");
        assert!(e.to_string().contains("SSL certificate problem"));
    }
}
