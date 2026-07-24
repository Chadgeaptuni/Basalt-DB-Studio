//! Opening, tracking, and closing live sessions. A `Session` is one connected
//! DB tab; the `SessionRegistry` maps its id to the driver. Introspection lifts
//! a cheap driver clone out under a short lock, then awaits the database with the
//! lock released, so one slow query never blocks other sessions.

use std::collections::HashMap;
use std::time::Duration;

use tokio::sync::Mutex;

use crate::config::connections::ConnectionProfile;
use crate::drivers::types::{Engine, SessionInfo};
use crate::drivers::Driver;
use crate::{AppError, AppResult};

/// Bounds the initial connect when the profile does not set one (spec: ~10s).
const DEFAULT_CONNECT_TIMEOUT_SECS: u64 = 10;

pub struct Session {
    pub info: SessionInfo,
    pub driver: Driver,
    pub read_only: bool,
}

pub type SessionRegistry = Mutex<HashMap<String, Session>>;

pub async fn connect(
    profile: &ConnectionProfile,
    registry: &SessionRegistry,
) -> AppResult<SessionInfo> {
    let driver = open_driver(profile).await?;
    let info = SessionInfo {
        session_id: uuid::Uuid::new_v4().to_string(),
        profile_id: profile.id.clone(),
        engine: profile.engine,
        read_only: profile.read_only,
    };
    registry.lock().await.insert(
        info.session_id.clone(),
        Session {
            info: info.clone(),
            driver,
            read_only: profile.read_only,
        },
    );
    Ok(info)
}

/// Opens a throwaway connection, confirms it works, then closes it.
pub async fn test_connection(profile: &ConnectionProfile) -> AppResult<()> {
    let driver = open_driver(profile).await?;
    driver.close().await;
    Ok(())
}

pub async fn disconnect(session_id: &str, registry: &SessionRegistry) -> AppResult<()> {
    // Remove under the lock, then close outside it (close awaits the pool).
    let session = registry.lock().await.remove(session_id);
    if let Some(session) = session {
        session.driver.close().await;
    }
    Ok(())
}

pub async fn introspect(
    session_id: &str,
    registry: &SessionRegistry,
) -> AppResult<crate::drivers::types::SchemaTree> {
    driver_for(session_id, registry).await?.introspect().await
}

pub async fn describe_table(
    session_id: &str,
    namespace: &str,
    table: &str,
    registry: &SessionRegistry,
) -> AppResult<crate::drivers::types::TableDescription> {
    driver_for(session_id, registry)
        .await?
        .describe_table(namespace, table)
        .await
}

/// Clones the session's driver handle out under a short lock.
async fn driver_for(session_id: &str, registry: &SessionRegistry) -> AppResult<Driver> {
    registry
        .lock()
        .await
        .get(session_id)
        .map(|s| s.driver.clone())
        .ok_or_else(|| AppError::Internal(format!("no active session '{session_id}'")))
}

async fn open_driver(profile: &ConnectionProfile) -> AppResult<Driver> {
    match profile.engine {
        Engine::Sqlite => open_sqlite(profile).await,
        Engine::Postgres => Err(AppError::Internal(
            "postgres support arrives in a later M1 slice".into(),
        )),
        Engine::MySql => Err(AppError::Internal(
            "mysql support arrives in a later M1 slice".into(),
        )),
    }
}

async fn open_sqlite(profile: &ConnectionProfile) -> AppResult<Driver> {
    use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

    let filename = profile
        .file_path
        .as_deref()
        .ok_or_else(|| AppError::ConfigParse("sqlite connection requires a filePath".into()))?;

    // `create_if_missing(false)`: connecting to a non-existent DB is an error, not
    // a silent empty-DB creation. `read_only` maps to SQLITE_OPEN_READONLY.
    let options = SqliteConnectOptions::new()
        .filename(filename)
        .read_only(profile.read_only)
        .create_if_missing(false);

    let timeout = Duration::from_secs(
        profile
            .connect_timeout_secs
            .unwrap_or(DEFAULT_CONNECT_TIMEOUT_SECS),
    );

    let pool = tokio::time::timeout(
        timeout,
        SqlitePoolOptions::new()
            .max_connections(4)
            .connect_with(options),
    )
    .await
    .map_err(|_| {
        AppError::ConnectionRefused(format!(
            "connection to '{filename}' timed out after {}s",
            timeout.as_secs()
        ))
    })?
    .map_err(|e| AppError::ConnectionRefused(e.to_string()))?;

    Ok(Driver::Sqlite(pool))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Creates a file-backed sqlite DB with one table so a fresh pool (opened by
    /// `connect`) sees the schema. Returns the file path.
    async fn seed_db_file() -> String {
        use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

        let path = std::env::temp_dir()
            .join(format!("basalt-conn-{}.db", uuid::Uuid::new_v4()))
            .to_string_lossy()
            .into_owned();
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(
                SqliteConnectOptions::new()
                    .filename(&path)
                    .create_if_missing(true),
            )
            .await
            .unwrap();
        sqlx::query("CREATE TABLE t (id INTEGER PRIMARY KEY)")
            .execute(&pool)
            .await
            .unwrap();
        pool.close().await;
        path
    }

    fn sqlite_profile(path: &str) -> ConnectionProfile {
        ConnectionProfile {
            id: "conn-test".into(),
            name: "test".into(),
            engine: Engine::Sqlite,
            host: None,
            port: None,
            database: None,
            username: None,
            file_path: Some(path.into()),
            read_only: false,
            connect_timeout_secs: Some(5),
            secret_ref: None,
            tls: None,
            ssh: None,
        }
    }

    #[tokio::test]
    async fn connect_introspect_disconnect_lifecycle() {
        let path = seed_db_file().await;
        let profile = sqlite_profile(&path);
        let registry: SessionRegistry = Mutex::new(HashMap::new());

        let info = connect(&profile, &registry).await.unwrap();
        assert_eq!(info.engine, Engine::Sqlite);
        assert_eq!(info.profile_id, "conn-test");

        let tree = introspect(&info.session_id, &registry).await.unwrap();
        assert!(tree.namespaces[0].relations.iter().any(|r| r.name == "t"));

        disconnect(&info.session_id, &registry).await.unwrap();
        assert!(registry.lock().await.is_empty());
        // Introspecting a gone session is a clear error, not a panic.
        assert_eq!(
            introspect(&info.session_id, &registry)
                .await
                .unwrap_err()
                .kind(),
            "internal"
        );

        std::fs::remove_file(&path).ok();
    }

    #[tokio::test]
    async fn connect_to_missing_file_is_connection_refused() {
        let profile = sqlite_profile("/nonexistent/basalt-missing.db");
        let registry: SessionRegistry = Mutex::new(HashMap::new());
        let err = connect(&profile, &registry).await.unwrap_err();
        assert_eq!(err.kind(), "connectionRefused");
    }

    #[tokio::test]
    async fn non_sqlite_engine_is_rejected_clearly() {
        let mut profile = sqlite_profile("/tmp/whatever.db");
        profile.engine = Engine::Postgres;
        let err = test_connection(&profile).await.unwrap_err();
        assert_eq!(err.kind(), "internal");
    }
}
