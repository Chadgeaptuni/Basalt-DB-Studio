//! DDL generation. The service only turns a structured request into engine SQL
//! (via `sqlgen::ddl`); the frontend previews it and runs it through the normal
//! query path, which owns the read-only / confirmation gates and schema refresh.

use crate::drivers::types::DdlRequest;
use crate::services::connection_service::{session_driver, SessionRegistry};
use crate::sqlgen;
use crate::AppResult;

/// Generates the SQL for a DDL request, using the session's engine dialect.
pub async fn generate(
    session_id: &str,
    request: &DdlRequest,
    registry: &SessionRegistry,
) -> AppResult<String> {
    let (driver, _read_only) = session_driver(session_id, registry).await?;
    sqlgen::ddl::generate(driver.engine(), request)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::connections::ConnectionProfile;
    use crate::drivers::types::{ColumnSpec, Engine};
    use crate::services::{connection_service, query_service};
    use std::collections::HashMap;
    use tokio::sync::Mutex;

    async fn sqlite_session() -> (String, SessionRegistry) {
        use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
        let path = std::env::temp_dir()
            .join(format!("basalt-ddl-{}.db", uuid::Uuid::new_v4()))
            .to_string_lossy()
            .into_owned();
        SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(
                SqliteConnectOptions::new()
                    .filename(&path)
                    .create_if_missing(true),
            )
            .await
            .unwrap()
            .close()
            .await;

        let profile = ConnectionProfile {
            id: "d".into(),
            name: "d".into(),
            engine: Engine::Sqlite,
            environment: None,
            host: None,
            port: None,
            database: None,
            username: None,
            file_path: Some(path),
            read_only: false,
            connect_timeout_secs: Some(5),
            secret_ref: None,
            tls: None,
            ssh: None,
        };
        let registry: SessionRegistry = Mutex::new(HashMap::new());
        let info = connection_service::connect(&profile, None, &registry)
            .await
            .unwrap();
        (info.session_id, registry)
    }

    async fn run(sid: &str, sql: &str, reg: &SessionRegistry) {
        let out = query_service::run(sid, sql, None, true, None, reg)
            .await
            .unwrap();
        for s in &out.statements {
            assert!(s.error.is_none(), "ddl failed [{sql}]: {:?}", s.error);
        }
    }

    // The M4 gate on SQLite: generate → execute → introspect for create/alter/
    // index/drop (pg + mysql are covered by tests/ddl_roundtrip.rs).
    #[tokio::test]
    async fn ddl_roundtrip_create_alter_index_drop() {
        let (sid, reg) = sqlite_session().await;
        let col = |n: &str, t: &str, nn: bool| ColumnSpec {
            name: n.into(),
            type_name: t.into(),
            nullable: nn,
            default: None,
        };

        let create = DdlRequest::CreateTable {
            namespace: "main".into(),
            name: "ddl_rt".into(),
            columns: vec![col("id", "integer", false), col("name", "text", true)],
            primary_key: vec!["id".into()],
        };
        run(&sid, &generate(&sid, &create, &reg).await.unwrap(), &reg).await;
        let desc = connection_service::describe_table(&sid, "main", "ddl_rt", &reg)
            .await
            .unwrap();
        assert!(desc.columns.iter().any(|c| c.name == "id" && c.is_pk));

        let add = DdlRequest::AddColumn {
            namespace: "main".into(),
            table: "ddl_rt".into(),
            column: col("amount", "numeric", true),
        };
        run(&sid, &generate(&sid, &add, &reg).await.unwrap(), &reg).await;
        let idx = DdlRequest::CreateIndex {
            namespace: "main".into(),
            table: "ddl_rt".into(),
            name: "ddl_rt_name_idx".into(),
            columns: vec!["name".into()],
            unique: false,
        };
        run(&sid, &generate(&sid, &idx, &reg).await.unwrap(), &reg).await;

        let desc = connection_service::describe_table(&sid, "main", "ddl_rt", &reg)
            .await
            .unwrap();
        assert!(desc.columns.iter().any(|c| c.name == "amount"));
        assert!(desc.indexes.iter().any(|i| i.name == "ddl_rt_name_idx"));

        let drop = DdlRequest::DropTable {
            namespace: "main".into(),
            name: "ddl_rt".into(),
        };
        run(&sid, &generate(&sid, &drop, &reg).await.unwrap(), &reg).await;
        // describe_table returns empty (not an error) for a missing table, so check
        // the tree: the relation must be gone from `main`.
        let tree = connection_service::introspect(&sid, &reg).await.unwrap();
        let main = tree.namespaces.iter().find(|n| n.name == "main");
        assert!(
            main.is_none_or(|n| !n.relations.iter().any(|r| r.name == "ddl_rt")),
            "table is gone after DROP"
        );
    }
}
