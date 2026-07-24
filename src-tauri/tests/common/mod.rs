//! Shared helpers for the env-gated integration tests. Included via `mod common;`
//! in each test binary; the caller self-skips when its `BASALT_TEST_*_URL` is
//! unset. `allow(dead_code)` because not every binary uses every helper.
#![allow(dead_code)]

use std::collections::HashMap;

use basalt_db_studio_lib::config::connections::ConnectionProfile;
use basalt_db_studio_lib::drivers::types::Engine;
use basalt_db_studio_lib::services::connection_service::SessionRegistry;
use tokio::sync::Mutex;

pub fn registry() -> SessionRegistry {
    Mutex::new(HashMap::new())
}

/// Parses `scheme://user:pass@host:port/db` into a profile plus the memory-only
/// password (the profile type has no password field by construction).
pub fn profile_from_url(url: &str) -> (ConnectionProfile, Option<String>) {
    let (scheme, rest) = url.split_once("://").expect("test url needs a scheme");
    let engine = match scheme {
        "postgres" | "postgresql" => Engine::Postgres,
        "mysql" => Engine::MySql,
        other => panic!("unsupported test url scheme: {other}"),
    };
    let (authority, database) = match rest.split_once('/') {
        Some((a, d)) if !d.is_empty() => (a, Some(d.to_string())),
        Some((a, _)) => (a, None),
        None => (rest, None),
    };
    // rsplit on '@' so a password containing ':' still splits correctly.
    let (userinfo, hostport) = match authority.rsplit_once('@') {
        Some((u, h)) => (Some(u), h),
        None => (None, authority),
    };
    let (username, password) = match userinfo {
        Some(ui) => match ui.split_once(':') {
            Some((u, p)) => (Some(u.to_string()), Some(p.to_string())),
            None => (Some(ui.to_string()), None),
        },
        None => (None, None),
    };
    let (host, port) = match hostport.split_once(':') {
        Some((h, p)) => (h.to_string(), p.parse().ok()),
        None => (hostport.to_string(), None),
    };

    let profile = ConnectionProfile {
        id: "it-test".into(),
        name: "integration".into(),
        engine,
        host: Some(host),
        port,
        database,
        username,
        file_path: None,
        read_only: false,
        connect_timeout_secs: Some(10),
        secret_ref: None,
        tls: None,
        ssh: None,
    };
    (profile, password)
}
