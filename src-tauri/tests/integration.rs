//! Integration tests against real Postgres + MySQL, seeded by
//! `docker-compose.test.yml` (schema in `tests/fixtures/`). They drive the
//! connection service end to end — connect → introspect → describe_table — and
//! self-skip when `BASALT_TEST_PG_URL` / `BASALT_TEST_MYSQL_URL` are unset.
//! SQLite coverage lives in the co-located unit tests (always run).

mod common;

use basalt_db_studio_lib::drivers::types::CellValue;
use basalt_db_studio_lib::services::{connection_service, query_service};
use common::{profile_from_url, registry};

#[tokio::test]
async fn postgres_connect_introspect_describe() {
    let Ok(url) = std::env::var("BASALT_TEST_PG_URL") else {
        eprintln!("BASALT_TEST_PG_URL unset — skipping postgres integration test");
        return;
    };
    let (profile, password) = profile_from_url(&url);
    let reg = registry();

    let info = connection_service::connect(&profile, password.as_deref(), None, &reg)
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

// The server-node behaviour: discover the databases over the maintenance
// connection, then open one of them as its own session. Both halves are asserted
// together because either alone is useless — a list you cannot open, or an
// override with nothing to point it at.
#[tokio::test]
async fn postgres_lists_databases_and_opens_a_second_session_on_one() {
    let Ok(url) = std::env::var("BASALT_TEST_PG_URL") else {
        eprintln!("BASALT_TEST_PG_URL unset — skipping postgres database-list test");
        return;
    };
    let (profile, password) = profile_from_url(&url);
    let reg = registry();

    let info = connection_service::connect(&profile, password.as_deref(), None, &reg)
        .await
        .expect("connect to postgres");

    let databases = connection_service::list_databases(&info.session_id, &reg)
        .await
        .expect("list databases");
    assert!(
        databases.contains(&"postgres".to_string()),
        "the default database is always listed: {databases:?}"
    );
    assert!(
        !databases.iter().any(|d| d.starts_with("template")),
        "templates are filtered out by datistemplate: {databases:?}"
    );
    assert!(
        databases.windows(2).all(|w| w[0] <= w[1]),
        "sorted by name: {databases:?}"
    );

    // The override must not disturb the first session: two pools, two ids.
    let second = connection_service::connect(&profile, password.as_deref(), Some("postgres"), &reg)
        .await
        .expect("connect to the postgres database by override");
    assert_ne!(second.session_id, info.session_id);
    assert_eq!(second.database.as_deref(), Some("postgres"));
    assert_eq!(second.profile_id, info.profile_id);

    connection_service::introspect(&second.session_id, &reg)
        .await
        .expect("the overridden session introspects");

    connection_service::disconnect(&second.session_id, &reg)
        .await
        .unwrap();
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

    let info = connection_service::connect(&profile, password.as_deref(), None, &reg)
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
    let err = connection_service::connect(&profile, Some("wrong-password"), None, &reg)
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
    let err = connection_service::connect(&profile, Some("wrong-password"), None, &reg)
        .await
        .expect_err("wrong password must fail");
    assert_eq!(err.kind(), "authFailed", "got: {err}");
}

#[tokio::test]
async fn postgres_run_query_decodes_edge_types() {
    let Ok(url) = std::env::var("BASALT_TEST_PG_URL") else {
        eprintln!("BASALT_TEST_PG_URL unset — skipping postgres run_query test");
        return;
    };
    let (profile, password) = profile_from_url(&url);
    let reg = registry();
    let info = connection_service::connect(&profile, password.as_deref(), None, &reg)
        .await
        .unwrap();

    let out = query_service::run(
        &info.session_id,
        "SELECT id, amount, feeling, tags FROM edge_types WHERE id = 1",
        None,
        false,
        None,
        &reg,
    )
    .await
    .expect("run select");
    let row = &out.statements[0].rows[0];
    assert_eq!(row[0], CellValue::Int(1));
    assert_eq!(row[1], CellValue::Decimal("12345.6789".into()));
    assert_eq!(
        row[2],
        CellValue::Text("happy".into()),
        "pg enum decodes as text"
    );
    assert_eq!(
        row[3],
        CellValue::Array(vec![
            CellValue::Int(1),
            CellValue::Int(2),
            CellValue::Int(3)
        ]),
        "int[] decodes as an array of ints"
    );

    // NULLs decode as Null (row 3 is all-NULL except id).
    let nulls = query_service::run(
        &info.session_id,
        "SELECT amount, feeling FROM edge_types WHERE id = 3",
        None,
        false,
        None,
        &reg,
    )
    .await
    .unwrap();
    assert_eq!(nulls.statements[0].rows[0][0], CellValue::Null);
}

#[tokio::test]
async fn mysql_run_query_decodes_edge_types() {
    let Ok(url) = std::env::var("BASALT_TEST_MYSQL_URL") else {
        eprintln!("BASALT_TEST_MYSQL_URL unset — skipping mysql run_query test");
        return;
    };
    let (profile, password) = profile_from_url(&url);
    let reg = registry();
    let info = connection_service::connect(&profile, password.as_deref(), None, &reg)
        .await
        .unwrap();

    let out = query_service::run(
        &info.session_id,
        "SELECT id, amount, flag, feeling FROM edge_types WHERE id = 1",
        None,
        false,
        None,
        &reg,
    )
    .await
    .expect("run select");
    let row = &out.statements[0].rows[0];
    assert_eq!(row[0], CellValue::Int(1));
    assert_eq!(row[1], CellValue::Decimal("12345.6789".into()));
    assert_eq!(row[2], CellValue::Bool(true), "tinyint(1) decodes as bool");
    assert_eq!(
        row[3],
        CellValue::Text("happy".into()),
        "enum decodes as text"
    );
}
