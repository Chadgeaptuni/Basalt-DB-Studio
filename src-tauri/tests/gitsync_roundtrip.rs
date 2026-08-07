//! M6 gate, run locally without Docker (git is always present): two "machines"
//! share connection profiles + saved queries through a bare repo, and a leak test
//! greps both working trees for a plaintext secret after the full workflow.
//!
//! Machine A saves + `sync` (commit → push); machine B `sync` (pull) and must see
//! the same files. The profile type has no password field by construction, so the
//! sentinel secret is never written anywhere — the grep proves it structurally.

use std::path::{Path, PathBuf};
use std::process::Command;

use basalt_db_studio_lib::config::connections::{self, ConnectionProfile};
use basalt_db_studio_lib::config::saved_queries;
use basalt_db_studio_lib::config::Paths;
use basalt_db_studio_lib::drivers::types::Engine;
use basalt_db_studio_lib::gitsync;

const SENTINEL_SECRET: &str = "hunter2-should-never-be-synced";

fn git(dir: &Path, args: &[&str]) {
    let out = Command::new("git")
        .arg("-C")
        .arg(dir)
        .args(args)
        .output()
        .expect("git available");
    assert!(
        out.status.success(),
        "git {args:?} failed: {}",
        String::from_utf8_lossy(&out.stderr)
    );
}

/// Clone `remote` to `dir` and give it a committer identity (CI has none global).
fn clone(remote: &Path, dir: &Path) {
    let out = Command::new("git")
        .args(["clone", &remote.to_string_lossy(), &dir.to_string_lossy()])
        .output()
        .expect("git available");
    assert!(out.status.success(), "clone failed");
    git(dir, &["config", "user.email", "test@basalt.local"]);
    git(dir, &["config", "user.name", "Basalt Test"]);
}

fn sample_profile() -> ConnectionProfile {
    ConnectionProfile {
        id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa".into(),
        name: "Shared Prod".into(),
        engine: Engine::Postgres,
        environment: None,
        host: Some("db.internal".into()),
        port: Some(5432),
        database: Some("app".into()),
        username: Some("app_ro".into()),
        file_path: None,
        read_only: true,
        connect_timeout_secs: None,
        // NO password field exists — only a reference into the SecretStore.
        secret_ref: Some("secret-uuid".into()),
        tls: None,
        ssh: None,
    }
}

/// Recursively assert `needle` appears in no file under `dir` (excluding `.git`).
fn assert_absent(dir: &Path, needle: &str) {
    for entry in std::fs::read_dir(dir).unwrap() {
        let path = entry.unwrap().path();
        if path.file_name().and_then(|n| n.to_str()) == Some(".git") {
            continue;
        }
        if path.is_dir() {
            assert_absent(&path, needle);
        } else {
            let bytes = std::fs::read(&path).unwrap();
            let text = String::from_utf8_lossy(&bytes);
            assert!(
                !text.contains(needle),
                "plaintext secret leaked into {}",
                path.display()
            );
        }
    }
}

#[test]
fn two_machines_share_config_and_no_secret_leaks() {
    let base = std::env::temp_dir().join(format!("basalt-sync-{}", uuid::Uuid::new_v4()));
    let remote = base.join("remote.git");
    let a_dir = base.join("A");
    let b_dir = base.join("B");
    std::fs::create_dir_all(&base).unwrap();

    // Bare "server" repo, then machine A as a clone of it.
    let init = Command::new("git")
        .args(["init", "--bare", &remote.to_string_lossy()])
        .output()
        .expect("git available");
    assert!(init.status.success(), "bare init failed");
    clone(&remote, &a_dir);

    // A saves a profile + a saved query, then syncs (commit → push).
    let pa = Paths::under(a_dir.clone());
    let profile = sample_profile();
    connections::save(&pa, &profile).unwrap();
    saved_queries::save(&pa, "reports/active-users", "select count(*) from users;").unwrap();

    let st = gitsync::status(&a_dir).unwrap();
    assert!(st.installed && st.is_repo && st.has_remote);
    assert!(
        !st.unstaged.is_empty(),
        "new files should show as working-tree changes"
    );

    let out_a = gitsync::sync(&a_dir, "add prod profile").unwrap();
    assert!(out_a.committed && out_a.pushed);

    // Machine B clones fresh — it should already carry A's pushed files.
    clone(&remote, &b_dir);
    let pb = Paths::under(b_dir.clone());
    assert_eq!(connections::load_all(&pb).unwrap(), vec![profile.clone()]);
    assert_eq!(
        saved_queries::read(&pb, "reports/active-users").unwrap(),
        "select count(*) from users;"
    );

    // A adds a second query and syncs; B pulls it via sync.
    saved_queries::save(
        &pa,
        "reports/signups",
        "select date, count(*) from signups group by 1;",
    )
    .unwrap();
    let out_a2 = gitsync::sync(&a_dir, "add signups query").unwrap();
    assert!(out_a2.pushed);

    let out_b = gitsync::sync(&b_dir, "pull").unwrap();
    assert!(out_b.pulled, "B should fast-forward A's commit");
    assert!(saved_queries::list(&pb)
        .unwrap()
        .iter()
        .any(|q| q.path == "reports/signups"));

    // The full workflow ran; the sentinel secret must be nowhere in either tree.
    assert_absent(&a_dir, SENTINEL_SECRET);
    assert_absent(&b_dir, SENTINEL_SECRET);

    cleanup(&base);
}

fn cleanup(base: &PathBuf) {
    std::fs::remove_dir_all(base).ok();
}

/// The granular client, against real git: stage a subset, commit it, branch,
/// read the history back, and diff a file. Everything below parses git's own
/// output, so the unit tests can only prove the parsers — this proves the
/// arguments produce output shaped the way the parsers expect.
#[test]
fn stages_commits_branches_and_reads_history_back() {
    let base = std::env::temp_dir().join(format!("basalt-git-ops-{}", uuid::Uuid::new_v4()));
    let repo = base.join("repo");
    std::fs::create_dir_all(&repo).unwrap();

    gitsync::init(&repo).unwrap();
    git(&repo, &["config", "user.email", "test@basalt.local"]);
    git(&repo, &["config", "user.name", "Basalt Test"]);

    let paths = Paths::under(repo.clone());
    saved_queries::save(&paths, "a", "select 1;").unwrap();
    saved_queries::save(&paths, "b", "select 2;").unwrap();

    // Both files are untracked, and neither is staged yet.
    let st = gitsync::status(&repo).unwrap();
    assert_eq!(st.unstaged.len(), 2, "two new files");
    assert!(st.staged.is_empty());

    // Stage one of the two — the point of a client over a Sync button.
    let a = st.unstaged[0].path.clone();
    gitsync::stage(&repo, std::slice::from_ref(&a)).unwrap();
    let st = gitsync::status(&repo).unwrap();
    assert_eq!(st.staged.len(), 1);
    assert_eq!(st.unstaged.len(), 1);

    // Unstaging puts it back without touching the file.
    gitsync::unstage(&repo, std::slice::from_ref(&a)).unwrap();
    assert!(gitsync::status(&repo).unwrap().staged.is_empty());

    gitsync::stage(&repo, &[".".to_string()]).unwrap();
    gitsync::commit(&repo, "add two queries").unwrap();

    let st = gitsync::status(&repo).unwrap();
    assert!(st.staged.is_empty() && st.unstaged.is_empty(), "tree is clean");
    assert!(st.branch.is_some(), "a committed repo is on a branch");
    assert!(st.upstream.is_none(), "no remote was ever added");

    // History carries the commit, its author and no parent (it is the root).
    let log = gitsync::history(&repo, 50).unwrap();
    assert_eq!(log.len(), 1);
    assert_eq!(log[0].subject, "add two queries");
    assert_eq!(log[0].author, "Basalt Test");
    assert!(log[0].parents.is_empty());
    assert!(log[0].refs.iter().any(|r| r.contains("HEAD")));

    // The commit's file list matches what was staged.
    let files = gitsync::commit_files(&repo, &log[0].hash).unwrap();
    assert_eq!(files.len(), 2, "both queries landed in one commit");

    // A second commit gains the first as a parent.
    saved_queries::save(&paths, "a", "select 3;").unwrap();
    gitsync::stage(&repo, &[".".to_string()]).unwrap();
    gitsync::commit(&repo, "edit a").unwrap();
    let log = gitsync::history(&repo, 50).unwrap();
    assert_eq!(log.len(), 2);
    assert_eq!(log[0].parents, vec![log[1].hash.clone()]);

    // Diffs come back as git's own unified text.
    let diff = gitsync::diff_commit_file(&repo, &log[0].hash, &a).unwrap();
    assert!(diff.contains("-select 1;"), "old line: {diff}");
    assert!(diff.contains("+select 3;"), "new line: {diff}");

    // Branching, and the listing that drives the switcher.
    gitsync::create_branch(&repo, "feature").unwrap();
    let branches = gitsync::branches(&repo).unwrap();
    let feature = branches.iter().find(|b| b.name == "feature").unwrap();
    assert!(feature.current && !feature.remote);

    // Discarding an uncommitted edit restores the committed content.
    saved_queries::save(&paths, "a", "select 999;").unwrap();
    assert!(!gitsync::status(&repo).unwrap().unstaged.is_empty());
    let dirty = gitsync::status(&repo).unwrap().unstaged[0].path.clone();
    gitsync::discard(&repo, &[dirty]).unwrap();
    assert!(gitsync::status(&repo).unwrap().unstaged.is_empty());
    assert_eq!(saved_queries::read(&paths, "a").unwrap(), "select 3;");

    cleanup(&base);
}

/// Every remote operation on a repo with no remote fails as `gitNoRemote`, not as
/// a generic error carrying git's advice text.
#[test]
fn remote_operations_without_a_remote_say_so() {
    let base = std::env::temp_dir().join(format!("basalt-git-noremote-{}", uuid::Uuid::new_v4()));
    let repo = base.join("repo");
    std::fs::create_dir_all(&repo).unwrap();

    gitsync::init(&repo).unwrap();
    git(&repo, &["config", "user.email", "test@basalt.local"]);
    git(&repo, &["config", "user.name", "Basalt Test"]);
    saved_queries::save(&Paths::under(repo.clone()), "a", "select 1;").unwrap();
    gitsync::stage(&repo, &[".".to_string()]).unwrap();
    gitsync::commit(&repo, "first").unwrap();

    for err in [
        gitsync::fetch(&repo).unwrap_err(),
        gitsync::pull(&repo).unwrap_err(),
        gitsync::push(&repo).unwrap_err(),
    ] {
        assert_eq!(err.kind(), "gitNoRemote");
    }

    cleanup(&base);
}
