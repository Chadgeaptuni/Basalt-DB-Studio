//! The commit DAG, for the history view's graph.
//!
//! Rust returns the graph's *shape* — each commit and its parents — and nothing
//! about how to draw it. Lane assignment is layout, so it lives in
//! `utils/commitGraph.ts` next to the component that renders it.

use std::path::Path;

use serde::Serialize;

use super::{git, require_repo};
use crate::AppResult;

#[derive(Serialize, Debug, PartialEq, Eq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Commit {
    pub hash: String,
    pub short: String,
    /// Two or more means a merge; zero means the root.
    pub parents: Vec<String>,
    pub author: String,
    pub email: String,
    /// ISO-8601 with offset, straight from git — the frontend formats it.
    pub date: String,
    pub subject: String,
    /// Branch and tag names pointing here, `HEAD` included.
    pub refs: Vec<String>,
}

// Unit and record separators rather than a newline or a NUL. A commit subject can
// contain a newline, and `-z` would use NUL for the record boundary — which would
// then collide with any NUL we used between fields. These two are the ASCII
// characters that exist for exactly this and appear in no real commit message.
const FIELD: char = '\x1f';
const RECORD: char = '\x1e';

pub fn history(dir: &Path, limit: u32) -> AppResult<Vec<Commit>> {
    require_repo(dir)?;

    let format = format!(
        "--format=%H{F}%h{F}%P{F}%an{F}%ae{F}%aI{F}%D{F}%s{R}",
        F = FIELD,
        R = RECORD
    );
    let max = format!("--max-count={limit}");
    // `--all` so branches other than the checked-out one are in the graph — a
    // history view that only shows HEAD's ancestry is a list, not a graph.
    // `--topo-order` keeps a branch's commits contiguous; date order interleaves
    // them and the lanes end up crossing for no reason the user can see.
    let out = git(dir, &["log", "--all", "--topo-order", &max, &format])?;

    // An empty repo has no HEAD, so `git log` fails rather than returning nothing.
    // That is not an error here — it is a repo you have not committed to yet.
    if !out.status.success() {
        return Ok(Vec::new());
    }

    Ok(String::from_utf8_lossy(&out.stdout)
        .split(RECORD)
        .filter_map(parse)
        .collect())
}

fn parse(record: &str) -> Option<Commit> {
    let record = record.trim_start_matches('\n');
    if record.is_empty() {
        return None;
    }
    let mut f = record.split(FIELD);
    let commit = Commit {
        hash: f.next()?.to_string(),
        short: f.next()?.to_string(),
        parents: f
            .next()?
            .split_whitespace()
            .map(str::to_string)
            .collect(),
        author: f.next()?.to_string(),
        email: f.next()?.to_string(),
        date: f.next()?.to_string(),
        refs: f
            .next()?
            .split(", ")
            .map(str::trim)
            .filter(|r| !r.is_empty())
            .map(str::to_string)
            .collect(),
        subject: f.next()?.to_string(),
    };
    (!commit.hash.is_empty()).then_some(commit)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn record(fields: &[&str]) -> String {
        fields.join(&FIELD.to_string())
    }

    #[test]
    fn reads_every_field_of_a_commit() {
        let c = parse(&record(&[
            "a1b2c3d4",
            "a1b2c3d",
            "parent1 parent2",
            "Ada",
            "ada@example.com",
            "2026-08-07T10:00:00+02:00",
            "HEAD -> main, origin/main",
            "feat(grid): add a column menu",
        ]))
        .expect("record should parse");

        assert_eq!(c.hash, "a1b2c3d4");
        assert_eq!(c.parents, ["parent1", "parent2"]);
        assert_eq!(c.author, "Ada");
        assert_eq!(c.refs, ["HEAD -> main", "origin/main"]);
        assert_eq!(c.subject, "feat(grid): add a column menu");
    }

    #[test]
    fn reads_a_root_commit_as_having_no_parents() {
        let c = parse(&record(&[
            "root",
            "root",
            "",
            "Ada",
            "ada@example.com",
            "2026-01-01T00:00:00Z",
            "",
            "initial",
        ]))
        .unwrap();

        assert!(c.parents.is_empty());
        assert!(c.refs.is_empty());
    }

    // The separators are chosen so a subject can hold anything; a message with a
    // comma in it must not be read as two refs, and one with a newline must not
    // split the record.
    #[test]
    fn keeps_a_subject_that_looks_like_other_fields() {
        let c = parse(&record(&[
            "h",
            "h",
            "",
            "Ada",
            "a@b.c",
            "2026-01-01T00:00:00Z",
            "",
            "fix: handle a, b\nand c",
        ]))
        .unwrap();

        assert_eq!(c.subject, "fix: handle a, b\nand c");
    }

    #[test]
    fn skips_the_blank_record_after_the_last_separator() {
        assert!(parse("").is_none());
        assert!(parse("\n").is_none());
    }
}
