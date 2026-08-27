//! DDL roundtrip against real Postgres + MySQL: generate → execute → introspect
//! for create table / add column / create index / rename column / drop table.
//! Every statement is the exact SQL the preview modal would show. Self-skips when
//! `BASALT_TEST_*_URL` is unset; SQLite is covered by `ddl_service` unit tests.

mod common;

use basalt_db_studio_lib::drivers::types::{ColumnSpec, DdlRequest};
use basalt_db_studio_lib::services::{connection_service, ddl_service, query_service};
use common::{profile_from_url, registry};

fn col(name: &str, ty: &str, nullable: bool) -> ColumnSpec {
    ColumnSpec {
        name: name.into(),
        type_name: ty.into(),
        nullable,
        default: None,
    }
}

async fn run_ddl(sid: &str, req: &DdlRequest, reg: &connection_service::SessionRegistry) {
    let sql = ddl_service::generate(sid, req, reg)
        .await
        .expect("generate ddl");
    let out = query_service::run(sid, &sql, None, true, None, reg)
        .await
        .expect("run ddl");
    for s in &out.statements {
        assert!(s.error.is_none(), "ddl failed [{sql}]: {:?}", s.error);
    }
}

async fn ddl_roundtrip(url: &str, namespace: &str) {
    let (profile, password) = profile_from_url(url);
    let reg = registry();
    let info = connection_service::connect(&profile, password.as_deref(), None, &reg)
        .await
        .expect("connect");
    let sid = &info.session_id;

    // Clean slate.
    query_service::run(sid, "DROP TABLE IF EXISTS ddl_rt", None, true, None, &reg)
        .await
        .unwrap();

    run_ddl(
        sid,
        &DdlRequest::CreateTable {
            namespace: namespace.into(),
            name: "ddl_rt".into(),
            columns: vec![col("id", "int", false), col("name", "varchar(50)", true)],
            primary_key: vec!["id".into()],
        },
        &reg,
    )
    .await;
    let desc = connection_service::describe_table(sid, namespace, "ddl_rt", &reg)
        .await
        .unwrap();
    assert!(desc.columns.iter().any(|c| c.name == "id" && c.is_pk));

    run_ddl(
        sid,
        &DdlRequest::AddColumn {
            namespace: namespace.into(),
            table: "ddl_rt".into(),
            column: col("amount", "numeric(10,2)", true),
        },
        &reg,
    )
    .await;
    run_ddl(
        sid,
        &DdlRequest::CreateIndex {
            namespace: namespace.into(),
            table: "ddl_rt".into(),
            name: "ddl_rt_name_idx".into(),
            columns: vec!["name".into()],
            unique: false,
        },
        &reg,
    )
    .await;
    run_ddl(
        sid,
        &DdlRequest::RenameColumn {
            namespace: namespace.into(),
            table: "ddl_rt".into(),
            from: "name".into(),
            to: "label".into(),
        },
        &reg,
    )
    .await;

    let desc = connection_service::describe_table(sid, namespace, "ddl_rt", &reg)
        .await
        .unwrap();
    assert!(desc.columns.iter().any(|c| c.name == "amount"));
    assert!(desc.columns.iter().any(|c| c.name == "label"));
    assert!(!desc.columns.iter().any(|c| c.name == "name"));
    assert!(desc.indexes.iter().any(|i| i.name == "ddl_rt_name_idx"));

    run_ddl(
        sid,
        &DdlRequest::DropTable {
            namespace: namespace.into(),
            name: "ddl_rt".into(),
        },
        &reg,
    )
    .await;
    // pg/MySQL describe_table returns empty (not an error) for a missing table, so
    // check the tree instead: the relation must be gone from its namespace.
    let tree = connection_service::introspect(sid, &reg).await.unwrap();
    let ns = tree.namespaces.iter().find(|n| n.name == namespace);
    assert!(
        ns.is_none_or(|n| !n.relations.iter().any(|r| r.name == "ddl_rt")),
        "table gone after DROP"
    );

    connection_service::disconnect(sid, &reg).await.unwrap();
}

#[tokio::test]
async fn postgres_ddl_roundtrip() {
    let Ok(url) = std::env::var("BASALT_TEST_PG_URL") else {
        eprintln!("BASALT_TEST_PG_URL unset — skipping postgres ddl roundtrip");
        return;
    };
    ddl_roundtrip(&url, "public").await;
}

#[tokio::test]
async fn mysql_ddl_roundtrip() {
    let Ok(url) = std::env::var("BASALT_TEST_MYSQL_URL") else {
        eprintln!("BASALT_TEST_MYSQL_URL unset — skipping mysql ddl roundtrip");
        return;
    };
    ddl_roundtrip(&url, "basalt_test").await;
}
