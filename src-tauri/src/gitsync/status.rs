//! What the repo looks like right now: branch, upstream distance, and the two
//! file lists the panel stages from.

use std::path::Path;

use serde::Serialize;

use super::{available, git, is_repo, rebase_or_merge_in_progress, stdout};
use crate::AppResult;

#[derive(Serialize, Debug, PartialEq, Eq, Clone, Copy)]
#[serde(rename_all = "camelCase")]
pub enum FileState {
    Added,
    Modified,
    Deleted,
    Renamed,
    Untracked,
    /// Both sides touched it during a merge or rebase. Not stageable from here —
    /// the panel sends the user to their own tool, because resolving a conflict
    /// is editing, and this app is not a text editor.
    Conflicted,
}

#[derive(Serialize, Debug, PartialEq, Eq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub path: String,
    pub state: FileState,
}

#[derive(Serialize, Default, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitStatus {
    pub installed: bool,
    pub is_repo: bool,
    pub has_remote: bool,
    pub branch: Option<String>,
    /// `origin/main` — `None` on a branch that has never been pushed.
    pub upstream: Option<String>,
    pub ahead: u32,
    pub behind: u32,
    pub staged: Vec<FileEntry>,
    pub unstaged: Vec<FileEntry>,
    pub conflicted: Vec<FileEntry>,
    /// A half-finished rebase or merge. Everything else is refused while true —
    /// running more git on top of one is how a repo gets genuinely stuck.
    pub in_progress: bool,
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
    let upstream = {
        let out = git(
            dir,
            &["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"],
        )?;
        out.success().then(|| stdout(&out))
    };
    let (ahead, behind) = ahead_behind(dir)?;
    let (staged, unstaged, conflicted) = changes(dir)?;

    Ok(GitStatus {
        installed: true,
        is_repo: true,
        has_remote: !stdout(&git(dir, &["remote"])?).is_empty(),
        branch,
        upstream,
        ahead,
        behind,
        staged,
        unstaged,
        conflicted,
        in_progress: rebase_or_merge_in_progress(dir),
    })
}

/// `ahead behind` vs the upstream; `(0, 0)` when there's no tracking branch.
pub(super) fn ahead_behind(dir: &Path) -> AppResult<(u32, u32)> {
    let out = git(
        dir,
        &["rev-list", "--left-right", "--count", "HEAD...@{upstream}"],
    )?;
    if !out.success() {
        return Ok((0, 0));
    }
    let s = stdout(&out);
    let mut nums = s.split_whitespace().filter_map(|n| n.parse().ok());
    Ok((nums.next().unwrap_or(0), nums.next().unwrap_or(0)))
}

/// Parse `git status --porcelain=v1 -z` into (staged, unstaged, conflicted).
///
/// `-z` rather than the line form: paths are emitted raw and NUL-terminated, so a
/// filename with a space, a quote or a non-ASCII character arrives intact. The
/// line form would quote and escape it, and we would have to unescape it back.
fn changes(dir: &Path) -> AppResult<(Vec<FileEntry>, Vec<FileEntry>, Vec<FileEntry>)> {
    let out = git(
        dir,
        &["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    )?;
    let raw = String::from_utf8_lossy(&out.stdout);

    let mut staged = Vec::new();
    let mut unstaged = Vec::new();
    let mut conflicted = Vec::new();

    // Records are `XY <path>\0`, and a rename adds a second `\0`-terminated field
    // holding the *old* path. Iterating rather than splitting into a Vec because
    // that trailing field has to be consumed by the record that owns it.
    let mut fields = raw.split('\0').filter(|f| !f.is_empty());
    while let Some(record) = fields.next() {
        if record.len() < 4 {
            continue;
        }
        let code = &record[..2];
        let path = record[3..].to_string();
        let (x, y) = (code.as_bytes()[0] as char, code.as_bytes()[1] as char);

        if code == "??" {
            unstaged.push(FileEntry {
                path,
                state: FileState::Untracked,
            });
            continue;
        }

        // Any 'U', or the doubled AA/DD, means both sides changed it.
        if x == 'U' || y == 'U' || code == "AA" || code == "DD" {
            conflicted.push(FileEntry {
                path,
                state: FileState::Conflicted,
            });
            continue;
        }

        if x == 'R' || x == 'C' {
            // Consume the old path this record carries, so it is not read back as
            // a record of its own on the next turn of the loop.
            fields.next();
        }
        if let Some(state) = index_state(x) {
            staged.push(FileEntry {
                path: path.clone(),
                state,
            });
        }
        if let Some(state) = worktree_state(y) {
            unstaged.push(FileEntry { path, state });
        }
    }

    Ok((staged, unstaged, conflicted))
}

fn index_state(x: char) -> Option<FileState> {
    match x {
        'A' => Some(FileState::Added),
        'M' => Some(FileState::Modified),
        'D' => Some(FileState::Deleted),
        'R' | 'C' => Some(FileState::Renamed),
        _ => None,
    }
}

fn worktree_state(y: char) -> Option<FileState> {
    match y {
        'M' => Some(FileState::Modified),
        'D' => Some(FileState::Deleted),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_index_and_worktree_columns_separately() {
        assert_eq!(index_state('A'), Some(FileState::Added));
        assert_eq!(index_state('M'), Some(FileState::Modified));
        // A clean column is not a state — it is the absence of one.
        assert_eq!(index_state(' '), None);
        assert_eq!(worktree_state(' '), None);
        // The worktree column never reports an add: an untracked file is `??`.
        assert_eq!(worktree_state('A'), None);
    }
}
