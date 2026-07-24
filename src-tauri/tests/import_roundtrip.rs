//! CSV import conflict modes against real Postgres + MySQL: insert / skip / upsert
//! emit each engine's native form; the batch runs in one transaction. Self-skips
//! when `BASALT_TEST_*_URL` is unset (SQLite is covered by import_service tests).

mod common;

use basalt_db_studio_lib::drivers::types::{CellValue, ConflictMode};
use basalt_db_studio_lib::services::{connection_service, import_service, query_service};
use common::{profile_from_url, registry};

fn write_csv(body: &str) -> String {
    let path = std::env::temp_dir().join(format!("basalt-imp-{}.csv", uuid::Uuid::new_v4()));
    std::fs::write(&path, body).unwrap();
    path.to_string_lossy().into_owned()
}

async fn scalar_text(sid: &str, sql: &str, reg: &connection_service::SessionRegistry) -> String {
    let out = query_service::run(sid, sql, None, false, None, reg)
        .await
        .unwrap();
    match &out.statements[0].rows[0][0] {
        CellValue::Text(s) => s.clone(),
        other => panic!("expected text, got {other:?}"),
    }
}

async fn import_roundtrip(url: &str, namespace: &str) {
    let (profile, password) = profile_from_url(url);
    let reg = registry();
    let info = connection_service::connect(&profile, password.as_deref(), &reg)
        .await
        .expect("connect");
    let sid = &info.session_id;
    let cols = vec!["id".to_string(), "name".to_string()];

    query_service::run(sid, "DROP TABLE IF EXISTS imp_rt", None, true, None, &reg)
        .await
        .unwrap();
    query_service::run(
        sid,
        "CREATE TABLE imp_rt (id int PRIMARY KEY, name varchar(50))",
        None,
        true,
        None,
        &reg,
    )
    .await
    .unwrap();

    // insert two rows.
    let f = write_csv("id,name\n1,orig\n2,two\n");
    let r = import_service::import(
        sid,
        namespace,
        "imp_rt",
        cols.clone(),
        true,
        ConflictMode::Insert,
        &f,
        &reg,
    )
    .await
    .expect("insert");
    assert_eq!(r.inserted, 2);

    // skip: id=1 conflict ignored; id=3 added; id=1 keeps 'orig'.
    let f = write_csv("id,name\n1,SKIP\n3,three\n");
    import_service::import(
        sid,
        namespace,
        "imp_rt",
        cols.clone(),
        true,
        ConflictMode::Skip,
        &f,
        &reg,
    )
    .await
    .expect("skip");
    assert_eq!(
        scalar_text(sid, "SELECT name FROM imp_rt WHERE id=1", &reg).await,
        "orig"
    );

    // upsert: id=1 updated to 'new' (native ON CONFLICT / ON DUPLICATE KEY).
    let f = write_csv("id,name\n1,new\n");
    import_service::import(
        sid,
        namespace,
        "imp_rt",
        cols,
        true,
        ConflictMode::Upsert,
        &f,
        &reg,
    )
    .await
    .expect("upsert");
    assert_eq!(
        scalar_text(sid, "SELECT name FROM imp_rt WHERE id=1", &reg).await,
        "new"
    );

    query_service::run(sid, "DROP TABLE imp_rt", None, true, None, &reg)
        .await
        .unwrap();
    connection_service::disconnect(sid, &reg).await.unwrap();
}

#[tokio::test]
async fn postgres_import_roundtrip() {
    let Ok(url) = std::env::var("BASALT_TEST_PG_URL") else {
        eprintln!("BASALT_TEST_PG_URL unset — skipping postgres import roundtrip");
        return;
    };
    import_roundtrip(&url, "public").await;
}

#[tokio::test]
async fn mysql_import_roundtrip() {
    let Ok(url) = std::env::var("BASALT_TEST_MYSQL_URL") else {
        eprintln!("BASALT_TEST_MYSQL_URL unset — skipping mysql import roundtrip");
        return;
    };
    import_roundtrip(&url, "basalt_test").await;
}
