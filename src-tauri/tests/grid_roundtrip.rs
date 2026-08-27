//! Flagship grid CRUD roundtrip against real Postgres + MySQL: create a table,
//! browse it, commit an update + insert (numeric, bool, NULL, text), and read the
//! edits back decoded. Verifies the per-engine bind direction — Postgres text +
//! `::type` cast, MySQL by-kind (a `TINYINT(1)` bool bound as 1/0, not "true").
//! Self-skips when `BASALT_TEST_*_URL` is unset; SQLite roundtrips live in the
//! `grid_service` unit tests (always run).

mod common;

use basalt_db_studio_lib::drivers::types::{CellChange, CellValue, GridEdit};
use basalt_db_studio_lib::services::{connection_service, grid_service, query_service};
use common::{profile_from_url, registry};

fn change(column: &str, value: CellValue) -> CellChange {
    CellChange {
        column: column.into(),
        value,
    }
}

/// Runs `sql` through the query service (confirmed, so DROP/DDL passes the gate)
/// and asserts every statement succeeded.
async fn run_sql(session_id: &str, sql: &str, registry: &connection_service::SessionRegistry) {
    let out = query_service::run(session_id, sql, None, true, None, registry)
        .await
        .unwrap();
    for s in &out.statements {
        assert!(s.error.is_none(), "setup failed [{sql}]: {:?}", s.error);
    }
}

async fn grid_roundtrip(url: &str, namespace: &str, create: &str) {
    let (profile, password) = profile_from_url(url);
    let reg = registry();
    let info = connection_service::connect(&profile, password.as_deref(), None, &reg)
        .await
        .expect("connect");
    let sid = &info.session_id;

    run_sql(sid, "DROP TABLE IF EXISTS grid_rt", &reg).await;
    run_sql(sid, create, &reg).await;
    run_sql(
        sid,
        "INSERT INTO grid_rt (id, name, amount, flag) VALUES (1, 'a', 1.50, TRUE)",
        &reg,
    )
    .await;

    let before = grid_service::browse(sid, namespace, "grid_rt", None, &reg)
        .await
        .expect("browse");
    assert_eq!(before.key_columns, ["id"]);
    assert!(!before.key_is_fallback && before.editable);
    assert_eq!(before.rows.len(), 1);

    let edits = vec![
        GridEdit::Update {
            key: vec![CellValue::Int(1)],
            set: vec![
                change("name", CellValue::Text("A".into())),
                change("amount", CellValue::Decimal("2.75".into())),
                change("flag", CellValue::Bool(false)),
            ],
        },
        GridEdit::Insert {
            set: vec![
                change("id", CellValue::Int(2)),
                change("name", CellValue::Text("b".into())),
                change("amount", CellValue::Null),
                change("flag", CellValue::Bool(true)),
            ],
        },
    ];
    let res = grid_service::commit(sid, namespace, "grid_rt", vec!["id".into()], edits, &reg)
        .await
        .expect("commit");
    assert_eq!(res.rows_affected, 2);

    let after = grid_service::browse(sid, namespace, "grid_rt", None, &reg)
        .await
        .unwrap();
    // Column order matches the CREATE: id, name, amount, flag.
    let row1 = after
        .rows
        .iter()
        .find(|r| r[0] == CellValue::Int(1))
        .expect("row 1");
    assert_eq!(row1[1], CellValue::Text("A".into()));
    assert_eq!(row1[2], CellValue::Decimal("2.75".into()));
    assert_eq!(
        row1[3],
        CellValue::Bool(false),
        "bool bound + decoded per engine"
    );
    let row2 = after
        .rows
        .iter()
        .find(|r| r[0] == CellValue::Int(2))
        .expect("row 2");
    assert_eq!(row2[2], CellValue::Null, "NULL amount stayed NULL");
    assert_eq!(row2[3], CellValue::Bool(true));

    run_sql(sid, "DROP TABLE grid_rt", &reg).await;
    connection_service::disconnect(sid, &reg).await.unwrap();
}

#[tokio::test]
async fn postgres_grid_roundtrip() {
    let Ok(url) = std::env::var("BASALT_TEST_PG_URL") else {
        eprintln!("BASALT_TEST_PG_URL unset — skipping postgres grid roundtrip");
        return;
    };
    grid_roundtrip(
        &url,
        "public",
        "CREATE TABLE grid_rt (id int PRIMARY KEY, name text, amount numeric(10,2), flag boolean)",
    )
    .await;
}

#[tokio::test]
async fn mysql_grid_roundtrip() {
    let Ok(url) = std::env::var("BASALT_TEST_MYSQL_URL") else {
        eprintln!("BASALT_TEST_MYSQL_URL unset — skipping mysql grid roundtrip");
        return;
    };
    grid_roundtrip(
        &url,
        "basalt_test",
        "CREATE TABLE grid_rt (id int PRIMARY KEY, name varchar(50), amount decimal(10,2), flag tinyint(1))",
    )
    .await;
}
