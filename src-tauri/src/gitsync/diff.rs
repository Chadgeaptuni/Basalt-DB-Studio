//! Diffs, returned as git's own unified text.
//!
//! Unparsed on purpose: hunk splitting is what the viewer needs and nothing else
//! does, so it happens once in `utils/diff.ts` beside the component. Sending
//! structured hunks over IPC would mean a second representation of the same
//! thing, kept in step by hand.

use std::path::Path;

use super::{git, require_repo, stdout};
use crate::gitsync::status::{FileEntry, FileState};
use crate::AppResult;

/// `--no-color` and `--no-ext-diff` because the user's own `.gitconfig` may set a
/// pager, a colour scheme or an external difftool, none of which survive being
/// pasted into a `<pre>`. `-U3` pins the context so the viewer's line numbers do
/// not shift with whoever's config it is.
const DIFF_FLAGS: &[&str] = &["--no-color", "--no-ext-diff", "-U3"];

/// A working-tree file's diff — staged (`HEAD` vs index) or not (index vs disk).
pub fn diff_worktree_file(dir: &Path, path: &str, staged: bool) -> AppResult<String> {
    require_repo(dir)?;

    let mut args = vec!["diff"];
    if staged {
        args.push("--cached");
    }
    args.extend_from_slice(DIFF_FLAGS);
    args.push("--");
    args.push(path);

    let out = git(dir, &args)?;
    let text = String::from_utf8_lossy(&out.stdout).to_string();

    // An untracked file has nothing to diff against, so `git diff` says nothing.
    // Showing it as an addition is more use than showing an empty pane.
    if text.is_empty() && !staged {
        return untracked_as_addition(dir, path);
    }
    Ok(text)
}

/// `--no-index` compares two paths git does not track, so the whole file reads as
/// added. It exits 1 when they differ, which here is the expected outcome and not
/// a failure.
fn untracked_as_addition(dir: &Path, path: &str) -> AppResult<String> {
    let null = if cfg!(windows) { "NUL" } else { "/dev/null" };
    let mut args = vec!["diff", "--no-index"];
    args.extend_from_slice(DIFF_FLAGS);
    args.push("--");
    args.push(null);
    args.push(path);

    Ok(String::from_utf8_lossy(&git(dir, &args)?.stdout).to_string())
}

/// The files a commit touched, with the same state vocabulary the panel uses.
pub fn commit_files(dir: &Path, hash: &str) -> AppResult<Vec<FileEntry>> {
    require_repo(dir)?;

    // `--name-status` with `-m --first-parent` so a merge reports what it brought
    // in rather than nothing at all, which is what a bare merge diff produces.
    let out = git(
        dir,
        &[
            "show",
            "--name-status",
            "--format=",
            "-m",
            "--first-parent",
            "-z",
            hash,
        ],
    )?;
    if !out.status.success() {
        return Ok(Vec::new());
    }

    let raw = String::from_utf8_lossy(&out.stdout);
    let mut fields = raw.split('\0').filter(|f| !f.is_empty());
    let mut files = Vec::new();

    // `-z` emits status and path as separate fields, and a rename emits three:
    // status, old path, new path.
    while let Some(code) = fields.next() {
        let letter = code.chars().next().unwrap_or(' ');
        let Some(first) = fields.next() else { break };
        let path = if letter == 'R' || letter == 'C' {
            fields.next().unwrap_or(first)
        } else {
            first
        };
        files.push(FileEntry {
            path: path.to_string(),
            state: match letter {
                'A' => FileState::Added,
                'D' => FileState::Deleted,
                'R' | 'C' => FileState::Renamed,
                _ => FileState::Modified,
            },
        });
    }

    Ok(files)
}

/// One file's diff inside a commit.
pub fn diff_commit_file(dir: &Path, hash: &str, path: &str) -> AppResult<String> {
    require_repo(dir)?;

    let mut args = vec!["show", "--format=", "-m", "--first-parent"];
    args.extend_from_slice(DIFF_FLAGS);
    args.push(hash);
    args.push("--");
    args.push(path);

    Ok(stdout(&git(dir, &args)?))
}
