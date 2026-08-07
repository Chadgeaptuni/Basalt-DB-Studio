//! Everything that changes the repo: staging, committing, moving branches, and
//! the three that touch the network.
//!
//! Every remote operation funnels its failure through `remote_error`, so an
//! expired GitHub token and a stale push produce different kinds with different
//! remedies instead of one `internal` carrying raw git output.

use std::path::Path;

use serde::Serialize;

use super::{
    git, rebase_or_merge_in_progress, remote_error, require_repo, status, stderr, stdout,
};
use crate::{AppError, AppResult};

#[derive(Serialize, Default, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SyncOutcome {
    pub committed: bool,
    pub pulled: bool,
    pub pushed: bool,
}

#[derive(Serialize, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Branch {
    /// `main`, or `origin/main` for a remote-tracking branch.
    pub name: String,
    pub current: bool,
    pub remote: bool,
}

/// Refuse to run anything on top of a half-finished rebase or merge. Every
/// mutating operation calls this first: git will often *let* you make it worse,
/// and a config repo the user cannot untangle is a worse outcome than a refusal.
fn require_settled(dir: &Path) -> AppResult<()> {
    require_repo(dir)?;
    if rebase_or_merge_in_progress(dir) {
        return Err(AppError::GitDirty(
            "an unfinished rebase or merge is in progress — resolve it in your git tool first"
                .into(),
        ));
    }
    Ok(())
}

/// Build `<verb> [flags] -- <paths>`. Always with `--`: a saved query named
/// `-f.sql` is a legal filename and an illegal flag, and without the separator
/// git would read it as the latter.
fn with_paths<'a>(head: &[&'a str], paths: &'a [String]) -> Vec<&'a str> {
    let mut args: Vec<&str> = head.to_vec();
    args.push("--");
    args.extend(paths.iter().map(String::as_str));
    args
}

fn run(dir: &Path, args: &[&str], op: &str) -> AppResult<()> {
    let out = git(dir, args)?;
    if out.status.success() {
        return Ok(());
    }
    Err(AppError::internal(format!(
        "git {op} failed: {}",
        stderr(&out)
    )))
}

pub fn stage(dir: &Path, paths: &[String]) -> AppResult<()> {
    require_settled(dir)?;
    run(dir, &with_paths(&["add"], paths), "add")
}

/// Whether HEAD resolves. False in a repo that has been `git init`ed and never
/// committed to — the ordinary first-run state of a config dir, and the state
/// half of git's verbs refuse to work in.
fn has_head(dir: &Path) -> AppResult<bool> {
    Ok(git(dir, &["rev-parse", "--verify", "--quiet", "HEAD"])?
        .status
        .success())
}

/// `restore --staged` resets the index *to HEAD*, so before the first commit
/// there is nothing to reset to and git refuses. Un-adding is the same operation
/// there, spelled differently.
pub fn unstage(dir: &Path, paths: &[String]) -> AppResult<()> {
    require_settled(dir)?;
    if has_head(dir)? {
        run(dir, &with_paths(&["restore", "--staged"], paths), "restore")
    } else {
        run(dir, &with_paths(&["rm", "--cached", "-r"], paths), "rm --cached")
    }
}

/// Throw away working-tree changes. Destructive and unrecoverable — git keeps no
/// copy — so the frontend routes it through `confirm()` before calling.
///
/// Tracked and untracked files need different verbs, and asking git which is
/// which beats trusting the caller's idea of it for an operation that deletes.
pub fn discard(dir: &Path, paths: &[String]) -> AppResult<()> {
    require_settled(dir)?;

    let listed = git(dir, &with_paths(&["ls-files"], paths))?;
    let tracked: Vec<String> = stdout(&listed).lines().map(str::to_string).collect();
    let untracked: Vec<String> = paths
        .iter()
        .filter(|p| !tracked.contains(p))
        .cloned()
        .collect();

    if !tracked.is_empty() {
        if has_head(dir)? {
            run(
                dir,
                &with_paths(&["restore", "--staged", "--worktree"], &tracked),
                "restore",
            )?;
        } else {
            // Before the first commit there is no version to restore *to*, so
            // discarding a staged file means un-adding it and deleting it — which
            // is what discarding a file that never existed in history amounts to.
            run(dir, &with_paths(&["rm", "-f"], &tracked), "rm")?;
        }
    }
    if !untracked.is_empty() {
        run(dir, &with_paths(&["clean", "-fd"], &untracked), "clean")?;
    }
    Ok(())
}

pub fn commit(dir: &Path, message: &str) -> AppResult<()> {
    require_settled(dir)?;
    if status(dir)?.staged.is_empty() {
        return Err(AppError::internal("nothing staged to commit"));
    }
    run(dir, &["commit", "-m", message], "commit")
}

pub fn fetch(dir: &Path) -> AppResult<()> {
    require_settled(dir)?;
    require_remote(dir)?;

    let out = git(dir, &["fetch", "--prune"])?;
    if out.status.success() {
        return Ok(());
    }
    Err(remote_error("fetch", &stderr(&out)))
}

/// `pull --rebase`: the config repo is a shared file store, and a merge commit
/// every time two people save a query would bury the history that makes the
/// graph worth looking at.
///
/// A conflict is aborted rather than left open. Resolving one is text editing,
/// which this app does not do, and leaving the user inside a rebase they cannot
/// finish here is worse than putting the tree back and saying so.
pub fn pull(dir: &Path) -> AppResult<()> {
    require_settled(dir)?;
    require_remote(dir)?;

    let out = git(dir, &["pull", "--rebase"])?;
    if out.status.success() {
        return Ok(());
    }
    if rebase_or_merge_in_progress(dir) {
        let _ = git(dir, &["rebase", "--abort"]);
        return Err(AppError::GitConflict(
            "pull hit a merge conflict — resolve it in your git tool, then try again".into(),
        ));
    }
    Err(remote_error("pull", &stderr(&out)))
}

/// Sets the upstream on first push, rather than failing with git's advice text.
/// A branch nobody has pushed yet is the normal state of a new config repo, not
/// a mistake to be corrected.
pub fn push(dir: &Path) -> AppResult<()> {
    require_settled(dir)?;
    require_remote(dir)?;

    let st = status(dir)?;
    let out = match (&st.upstream, &st.branch) {
        (Some(_), _) => git(dir, &["push"])?,
        (None, Some(branch)) => git(dir, &["push", "--set-upstream", "origin", branch])?,
        (None, None) => {
            return Err(AppError::GitNoRemote(
                "HEAD is detached — check out a branch before pushing".into(),
            ))
        }
    };

    if out.status.success() {
        return Ok(());
    }
    Err(remote_error("push", &stderr(&out)))
}

fn require_remote(dir: &Path) -> AppResult<()> {
    if stdout(&git(dir, &["remote"])?).is_empty() {
        return Err(AppError::GitNoRemote(
            "this repository has no remote — add one to sync with a team".into(),
        ));
    }
    Ok(())
}

const BRANCH_FIELD: char = '\x1f';

pub fn branches(dir: &Path) -> AppResult<Vec<Branch>> {
    require_repo(dir)?;

    let format = format!(
        "--format=%(refname){F}%(refname:short){F}%(HEAD)",
        F = BRANCH_FIELD
    );
    let out = git(
        dir,
        &["for-each-ref", &format, "refs/heads", "refs/remotes"],
    )?;

    Ok(stdout(&out)
        .lines()
        .filter_map(|line| {
            let mut f = line.split(BRANCH_FIELD);
            let refname = f.next()?;
            let name = f.next()?.to_string();
            // `origin/HEAD` is a symbolic pointer at the remote's default branch,
            // not a branch you can check out. Listing it offers a no-op.
            if name.ends_with("/HEAD") {
                return None;
            }
            Some(Branch {
                current: f.next()? == "*",
                remote: refname.starts_with("refs/remotes/"),
                name,
            })
        })
        .collect())
}

pub fn checkout(dir: &Path, name: &str) -> AppResult<()> {
    require_settled(dir)?;
    run(dir, &["checkout", name], "checkout")
}

pub fn create_branch(dir: &Path, name: &str) -> AppResult<()> {
    require_settled(dir)?;
    run(dir, &["checkout", "-b", name], "checkout -b")
}

/// Make the config dir a repo. Safe to call on one that already is — `git init`
/// is idempotent — but the panel only offers it when there is none.
pub fn init(dir: &Path) -> AppResult<()> {
    if !super::available() {
        return Err(AppError::GitNotInstalled(
            "git is not installed or not on PATH".into(),
        ));
    }
    run(dir, &["init"], "init")
}

/// Point `origin` at a URL, adding it if it is not there yet.
pub fn set_remote(dir: &Path, url: &str) -> AppResult<()> {
    require_repo(dir)?;
    if stdout(&git(dir, &["remote"])?).split_whitespace().any(|r| r == "origin") {
        run(dir, &["remote", "set-url", "origin", url], "remote set-url")
    } else {
        run(dir, &["remote", "add", "origin", url], "remote add")
    }
}

/// The one-button flow the product is built around: stage everything, commit,
/// rebase onto whatever teammates pushed, push. Composed from the operations
/// above so the pieces and the shortcut cannot drift apart.
pub fn sync(dir: &Path, message: &str) -> AppResult<SyncOutcome> {
    require_settled(dir)?;

    let mut outcome = SyncOutcome::default();

    stage(dir, &[".".to_string()])?;
    if !status(dir)?.staged.is_empty() {
        commit(dir, message)?;
        outcome.committed = true;
    }

    if stdout(&git(dir, &["remote"])?).is_empty() {
        return Ok(outcome); // Local-only repo: committed, nothing to push.
    }

    // Skip the pull on the very first push — there is no upstream to rebase onto
    // yet, and `push` below will create one.
    if status(dir)?.upstream.is_some() {
        pull(dir)?;
        outcome.pulled = true;
    }
    push(dir)?;
    outcome.pushed = true;

    Ok(outcome)
}

#[cfg(test)]
mod tests {
    use super::*;

    // The separator matters: a saved query may legally be named `-f.sql`, which
    // git would otherwise read as a flag.
    #[test]
    fn always_separates_paths_from_flags() {
        let paths = vec!["-f.sql".to_string(), "queries/a b.sql".to_string()];
        let args = with_paths(&["add"], &paths);
        assert_eq!(args, ["add", "--", "-f.sql", "queries/a b.sql"]);
    }

    #[test]
    fn keeps_flags_ahead_of_the_separator() {
        let paths = vec!["x".to_string()];
        assert_eq!(
            with_paths(&["restore", "--staged"], &paths),
            ["restore", "--staged", "--", "x"]
        );
    }
}
