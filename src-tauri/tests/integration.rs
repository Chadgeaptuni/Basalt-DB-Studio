//! Integration tests against real Postgres + MySQL, seeded by
//! `docker-compose.test.yml` (schema in `tests/fixtures/`). They drive the
//! connection service end to end — connect → introspect → describe_table — and
//! self-skip when `BASALT_TEST_PG_URL` / `BASALT_TEST_MYSQL_URL` are unset.
//! SQLite coverage lives in the co-located unit tests (always run).

use std::collections::HashMap;

use basalt_db_studio_lib::config::connections::ConnectionProfile;
use basalt_db_studio_lib::drivers::types::Engine;
use basalt_db_studio_lib::services::connection_service::{self, SessionRegistry};
use tokio::sync::Mutex;

/// Parses `scheme://user:pass@host:port/db` into a profile plus the memory-only
/// password (the profile type has no password field by construction).
fn profile_from_url(url: &str) -> (ConnectionProfile, Option<String>) {
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

fn registry() -> SessionRegistry {
    Mutex::new(HashMap::new())
}

#[tokio::test]
async fn postgres_connect_introspect_describe() {
    let Ok(url) = std::env::var("BASALT_TEST_PG_URL") else {
        eprintln!("BASALT_TEST_PG_URL unset — skipping postgres integration test");
        return;
    };
    let (profile, password) = profile_from_url(&url);
    let reg = registry();

    let info = connection_service::connect(&profile, password.as_deref(), &reg)
        .await
        .expect("connect to postgres");

    let tree = connection_service::introspect(&info.session_id, &reg)
        .await
        .expect("introspect postgres");
    let public = tree
        .namespaces
        .iter()
        .find(|n| n.name == "public")
        .expect("public schema present");
    assert!(public.relations.iter().any(|r| r.name == "users"));
    assert!(public.relations.iter().any(|r| r.name == "edge_types"));

    let desc = connection_service::describe_table(&info.session_id, "public", "edge_types", &reg)
        .await
        .expect("describe edge_types");
    let id = desc.columns.iter().find(|c| c.name == "id").unwrap();
    assert!(id.is_pk && !id.nullable, "id is the non-null primary key");
    let big = desc.columns.iter().find(|c| c.name == "big").unwrap();
    assert!(big.nullable && !big.is_pk);
    // format_type gives canonical spellings, not information_schema's generics.
    let amount = desc.columns.iter().find(|c| c.name == "amount").unwrap();
    assert_eq!(amount.type_name, "numeric(20,4)");
    let tags = desc.columns.iter().find(|c| c.name == "tags").unwrap();
    assert_eq!(tags.type_name, "integer[]");
    let feeling = desc.columns.iter().find(|c| c.name == "feeling").unwrap();
    assert_eq!(feeling.type_name, "mood", "enum type shows its own name");

    // The PK's implicit unique index is reported (as a DB GUI should).
    let users = connection_service::describe_table(&info.session_id, "public", "users", &reg)
        .await
        .unwrap();
    assert!(users
        .indexes
        .iter()
        .any(|i| i.unique && i.columns == ["id"]));

    connection_service::disconnect(&info.session_id, &reg)
        .await
        .unwrap();
}

#[tokio::test]
async fn mysql_connect_introspect_describe() {
    let Ok(url) = std::env::var("BASALT_TEST_MYSQL_URL") else {
        eprintln!("BASALT_TEST_MYSQL_URL unset — skipping mysql integration test");
        return;
    };
    let (profile, password) = profile_from_url(&url);
    let reg = registry();

    let info = connection_service::connect(&profile, password.as_deref(), &reg)
        .await
        .expect("connect to mysql");

    let tree = connection_service::introspect(&info.session_id, &reg)
        .await
        .expect("introspect mysql");
    let db = tree
        .namespaces
        .iter()
        .find(|n| n.name == "basalt_test")
        .expect("basalt_test database present");
    assert!(db.relations.iter().any(|r| r.name == "users"));
    assert!(db.relations.iter().any(|r| r.name == "edge_types"));

    let desc =
        connection_service::describe_table(&info.session_id, "basalt_test", "edge_types", &reg)
            .await
            .expect("describe edge_types");
    let id = desc.columns.iter().find(|c| c.name == "id").unwrap();
    assert!(id.is_pk && !id.nullable, "id is the non-null primary key");
    // column_type carries the full declaration MySQL stores.
    let amount = desc.columns.iter().find(|c| c.name == "amount").unwrap();
    assert_eq!(amount.type_name, "decimal(20,4)");
    let flag = desc.columns.iter().find(|c| c.name == "flag").unwrap();
    assert_eq!(flag.type_name, "tinyint(1)");
    let feeling = desc.columns.iter().find(|c| c.name == "feeling").unwrap();
    assert!(
        feeling.type_name.starts_with("enum("),
        "enum shows its variants, got {}",
        feeling.type_name
    );

    let users = connection_service::describe_table(&info.session_id, "basalt_test", "users", &reg)
        .await
        .unwrap();
    assert!(users
        .indexes
        .iter()
        .any(|i| i.name == "PRIMARY" && i.unique && i.columns == ["id"]));

    connection_service::disconnect(&info.session_id, &reg)
        .await
        .unwrap();
}

// A bad password must surface as the `authFailed` kind (SQLSTATE class 28), not a
// generic refusal — the frontend renders it differently. Verified per engine.
#[tokio::test]
async fn postgres_wrong_password_is_auth_failed() {
    let Ok(url) = std::env::var("BASALT_TEST_PG_URL") else {
        eprintln!("BASALT_TEST_PG_URL unset — skipping postgres auth test");
        return;
    };
    let (profile, _) = profile_from_url(&url);
    let reg = registry();
    let err = connection_service::connect(&profile, Some("wrong-password"), &reg)
        .await
        .expect_err("wrong password must fail");
    assert_eq!(err.kind(), "authFailed", "got: {err}");
}

#[tokio::test]
async fn mysql_wrong_password_is_auth_failed() {
    let Ok(url) = std::env::var("BASALT_TEST_MYSQL_URL") else {
        eprintln!("BASALT_TEST_MYSQL_URL unset — skipping mysql auth test");
        return;
    };
    let (profile, _) = profile_from_url(&url);
    let reg = registry();
    let err = connection_service::connect(&profile, Some("wrong-password"), &reg)
        .await
        .expect_err("wrong password must fail");
    assert_eq!(err.kind(), "authFailed", "got: {err}");
}
