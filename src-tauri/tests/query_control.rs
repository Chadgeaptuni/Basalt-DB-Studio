//! The editor's pinned connection against real engines: a transaction outlives
//! the run that opened it, and a cancel stops the server's statement without
//! losing the session. Self-skips when `BASALT_TEST_*_URL` is unset.

mod common;

use std::time::Duration;

use basalt_db_studio_lib::drivers::types::{CellValue, RunResult, TxStatus};
use basalt_db_studio_lib::services::connection_service::{self, SessionRegistry};
use basalt_db_studio_lib::services::query_service;
use common::{profile_from_url, registry};

async fn run(sid: &str, sql: &str, reg: &SessionRegistry) -> RunResult {
    query_service::run(sid, sql, None, true, None, None, reg)
        .await
        .unwrap_or_else(|e| panic!("{sql}: {e}"))
}

async fn tx_and_cancel(url: &str, slow: &str) {
    let (profile, password) = profile_from_url(url);
    let reg = registry();
    let sid = connection_service::connect(&profile, password.as_deref(), None, None, &reg)
        .await
        .unwrap()
        .session_id;

    run(&sid, "DROP TABLE IF EXISTS qc_t", &reg).await;
    run(&sid, "CREATE TABLE qc_t (id int)", &reg).await;
    assert_eq!(run(&sid, "BEGIN", &reg).await.tx_status, TxStatus::InTx);
    assert_eq!(
        run(&sid, "INSERT INTO qc_t VALUES (1)", &reg)
            .await
            .tx_status,
        TxStatus::InTx
    );
    assert_eq!(run(&sid, "ROLLBACK", &reg).await.tx_status, TxStatus::Idle);
    let count = run(&sid, "SELECT count(*) FROM qc_t", &reg).await;
    assert_eq!(count.statements[0].rows[0][0], CellValue::Int(0));

    let (out, cancelled) = tokio::join!(run(&sid, slow, &reg), async {
        tokio::time::sleep(Duration::from_millis(500)).await;
        query_service::cancel(&sid, &reg).await
    });
    cancelled.unwrap();
    let error = out.statements[0]
        .error
        .as_ref()
        .expect("cancelled statement fails");
    assert_eq!(error.kind, "queryCancelled", "{}", error.message);
    assert!(run(&sid, "SELECT 1", &reg).await.statements[0]
        .error
        .is_none());

    run(&sid, "DROP TABLE qc_t", &reg).await;
}

#[tokio::test]
async fn postgres_tx_spans_runs_and_cancel_keeps_the_session() {
    let Ok(url) = std::env::var("BASALT_TEST_PG_URL") else {
        eprintln!("BASALT_TEST_PG_URL unset — skipping postgres query-control test");
        return;
    };
    tx_and_cancel(&url, "SELECT pg_sleep(30)").await;
}

#[tokio::test]
async fn mysql_tx_spans_runs_and_cancel_keeps_the_session() {
    let Ok(url) = std::env::var("BASALT_TEST_MYSQL_URL") else {
        eprintln!("BASALT_TEST_MYSQL_URL unset — skipping mysql query-control test");
        return;
    };
    // A real scan, not SLEEP() or BENCHMARK(): both swallow the interrupt and
    // return a value, where a scan fails with ER_QUERY_INTERRUPTED.
    tx_and_cancel(
        &url,
        "SELECT count(*) FROM information_schema.columns a, information_schema.columns b, \
         information_schema.columns c",
    )
    .await;
}
