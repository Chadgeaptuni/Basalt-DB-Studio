//! Git-sync: the config dir *is* the repo. We shell out to **system git** (no
//! `git2`/`gix` — bundle weight; target users have git). Sync is manual-only in
//! v1: `add -A` → `commit` → `pull --rebase` → `push`. Nothing here imports
//! `tauri`; commands call it on a blocking thread.
//!
//! Error mapping: git missing → `gitNotInstalled`; a rebase this sync triggers
//! that conflicts → `gitConflict` (we `rebase --abort` first, leaving the tree
//! clean, then tell the user to resolve in their own git tool); a *pre-existing*
//! unfinished rebase/merge → `gitDirty` (resolve that first).

use std::path::Path;
use std::process::{Command, Output};

use serde::Serialize;

use crate::{AppError, AppResult};

/// Snapshot for the sync badge. All-false/zero when git is absent.
#[derive(Serialize, Default, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitStatus {
    pub installed: bool,
    pub is_repo: bool,
    pub has_remote: bool,
    pub branch: Option<String>,
    /// Uncommitted/untracked entries (`git status --porcelain` lines).
    pub dirty: u32,
    pub ahead: u32,
    pub behind: u32,
}

/// What a sync actually did — drives the toast ("committed 3, pushed").
#[derive(Serialize, Default, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SyncOutcome {
    pub committed: bool,
    pub pulled: bool,
    pub pushed: bool,
}

fn available() -> bool {
    Command::new("git")
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// Run `git -C <dir> <args>`, mapping a missing binary to `gitNotInstalled`.
fn git(dir: &Path, args: &[&str]) -> AppResult<Output> {
    Command::new("git")
        .arg("-C")
        .arg(dir)
        .args(args)
        .output()
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                AppError::GitNotInstalled("git is not installed or not on PATH".into())
            } else {
                AppError::internal(e)
            }
        })
}

fn stdout(o: &Output) -> String {
    String::from_utf8_lossy(&o.stdout).trim().to_string()
}

pub fn status(dir: &Path) -> AppResult<GitStatus> {
    if !available() {
        return Ok(GitStatus::default());
    }
    if !dir.exists() || !is_repo(dir)? {
        return Ok(GitStatus {
            installed: true,
            ..Default::default()
        });
    }

    let branch = {
        let b = stdout(&git(dir, &["rev-parse", "--abbrev-ref", "HEAD"])?);
        (!b.is_empty() && b != "HEAD").then_some(b)
    };
    let has_remote = !stdout(&git(dir, &["remote"])?).is_empty();
    let dirty = stdout(&git(dir, &["status", "--porcelain"])?)
        .lines()
        .filter(|l| !l.is_empty())
        .count() as u32;
    let (ahead, behind) = ahead_behind(dir)?;

    Ok(GitStatus {
        installed: true,
        is_repo: true,
        has_remote,
        branch,
        dirty,
        ahead,
        behind,
    })
}

fn is_repo(dir: &Path) -> AppResult<bool> {
    Ok(stdout(&git(dir, &["rev-parse", "--is-inside-work-tree"])?) == "true")
}

/// Whether the current branch's upstream ref resolves — false on a fresh clone of
/// an empty remote (nothing fetched yet), where the first sync must skip the pull.
fn upstream_exists(dir: &Path) -> AppResult<bool> {
    Ok(
        git(dir, &["rev-parse", "--verify", "--quiet", "@{upstream}"])?
            .status
            .success(),
    )
}

/// `ahead behind` vs the upstream; `(0, 0)` when there's no tracking branch.
fn ahead_behind(dir: &Path) -> AppResult<(u32, u32)> {
    let out = git(
        dir,
        &["rev-list", "--left-right", "--count", "HEAD...@{upstream}"],
    )?;
    if !out.status.success() {
        return Ok((0, 0));
    }
    let s = stdout(&out);
    let mut nums = s.split_whitespace().filter_map(|n| n.parse().ok());
    Ok((nums.next().unwrap_or(0), nums.next().unwrap_or(0)))
}

/// `add -A` → `commit` → (if a remote exists) `pull --rebase` → `push`.
pub fn sync(dir: &Path, message: &str) -> AppResult<SyncOutcome> {
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
    if rebase_or_merge_in_progress(dir) {
        return Err(AppError::GitDirty(
            "an unfinished rebase/merge is in progress — resolve it in git first".into(),
        ));
    }

    let mut outcome = SyncOutcome::default();

    git(dir, &["add", "-A"])?;
    let commit = git(dir, &["commit", "-m", message])?;
    // A no-op commit ("nothing to commit") is fine — keep syncing.
    outcome.committed = commit.status.success();

    if stdout(&git(dir, &["remote"])?).is_empty() {
        return Ok(outcome); // Local-only repo: committed, nothing to push.
    }

    // Skip the pull on the very first push (the upstream branch doesn't exist
    // yet); otherwise rebase our commit onto whatever teammates pushed.
    if upstream_exists(dir)? {
        let pull = git(dir, &["pull", "--rebase"])?;
        if !pull.status.success() {
            if rebase_or_merge_in_progress(dir) {
                // Leave the tree clean; the user resolves in their own git tool.
                let _ = git(dir, &["rebase", "--abort"]);
                return Err(AppError::GitConflict(
                    "sync hit a merge conflict — resolve it in your git tool, then retry".into(),
                ));
            }
            return Err(AppError::internal(format!(
                "git pull failed: {}",
                String::from_utf8_lossy(&pull.stderr).trim()
            )));
        }
        outcome.pulled = true;
    }

    let push = git(dir, &["push"])?;
    if !push.status.success() {
        return Err(AppError::internal(format!(
            "git push failed: {}",
            String::from_utf8_lossy(&push.stderr).trim()
        )));
    }
    outcome.pushed = true;

    Ok(outcome)
}

fn rebase_or_merge_in_progress(dir: &Path) -> bool {
    let g = dir.join(".git");
    g.join("rebase-merge").exists()
        || g.join("rebase-apply").exists()
        || g.join("MERGE_HEAD").exists()
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
        assert_eq!(st.dirty, 0);
    }
}
