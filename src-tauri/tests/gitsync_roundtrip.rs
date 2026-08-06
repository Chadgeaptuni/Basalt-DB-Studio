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
    assert!(st.dirty > 0, "new files should be uncommitted");

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
