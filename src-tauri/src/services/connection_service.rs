//! Opening, tracking, and closing live sessions. A `Session` is one connected
//! DB tab; the `SessionRegistry` maps its id to the driver. Introspection lifts
//! a cheap driver clone out under a short lock, then awaits the database with the
//! lock released, so one slow query never blocks other sessions.

use std::borrow::Cow;
use std::collections::HashMap;
use std::time::Duration;

use tokio::sync::Mutex;

use crate::config::connections::ConnectionProfile;
use crate::drivers::types::{Engine, SessionInfo, SslMode};
use crate::drivers::Driver;
use crate::{AppError, AppResult};

/// Bounds the initial connect when the profile does not set one (spec: ~10s).
const DEFAULT_CONNECT_TIMEOUT_SECS: u64 = 10;
/// Pool size per session — small; a GUI drives a handful of concurrent queries.
const POOL_MAX: u32 = 4;
/// Where a Postgres profile connects when it names no database. Every stock
/// server has one, and it is what pgAdmin defaults its "maintenance database"
/// field to — the connection it discovers the rest of the server over.
const PG_MAINTENANCE_DB: &str = "postgres";

pub struct Session {
    pub info: SessionInfo,
    pub driver: Driver,
    pub read_only: bool,
}

pub type SessionRegistry = Mutex<HashMap<String, Session>>;

/// Opens a session. `database` overrides the profile's — that is how a second
/// Postgres database on the same server is browsed, since a pg connection can
/// never leave the database it opened. The override is applied to a copy so the
/// saved profile stays the maintenance database it was configured as.
pub async fn connect(
    profile: &ConnectionProfile,
    password: Option<&str>,
    database: Option<&str>,
    registry: &SessionRegistry,
) -> AppResult<SessionInfo> {
    let profile = effective_profile(profile, database);
    let profile = profile.as_ref();

    let driver = open_driver(profile, password).await?;
    let info = SessionInfo {
        session_id: uuid::Uuid::new_v4().to_string(),
        profile_id: profile.id.clone(),
        engine: profile.engine,
        read_only: profile.read_only,
        database: profile.database.clone(),
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

/// The profile a session actually opens. `database` overrides the profile's own
/// — that is a Postgres database node opening its own pool. A Postgres profile
/// that names no database at all falls back to the maintenance database, because
/// "no database" is not a state a pg session can be in: sqlx would otherwise
/// connect to one named after the *user*, which usually does not exist, and the
/// miss surfaces as a connection failure rather than as the empty field it is.
fn effective_profile<'a>(
    profile: &'a ConnectionProfile,
    database: Option<&str>,
) -> Cow<'a, ConnectionProfile> {
    let resolved = database
        .map(str::to_owned)
        .or_else(|| profile.database.clone())
        .or_else(|| {
            (profile.engine == Engine::Postgres).then(|| PG_MAINTENANCE_DB.to_owned())
        });

    if resolved == profile.database {
        Cow::Borrowed(profile)
    } else {
        Cow::Owned(ConnectionProfile {
            database: resolved,
            ..profile.clone()
        })
    }
}

/// Opens a throwaway connection, confirms it works, then closes it. Resolves the
/// same effective profile `connect` would, so Test never passes on a target
/// Connect would miss.
pub async fn test_connection(profile: &ConnectionProfile, password: Option<&str>) -> AppResult<()> {
    let driver = open_driver(effective_profile(profile, None).as_ref(), password).await?;
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

pub async fn list_databases(session_id: &str, registry: &SessionRegistry) -> AppResult<Vec<String>> {
    driver_for(session_id, registry).await?.list_databases().await
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
    Ok(session_driver(session_id, registry).await?.0)
}

/// The session's driver handle plus its read-only flag (for the query service's
/// read-only gate), cloned out under a short lock.
pub async fn session_driver(
    session_id: &str,
    registry: &SessionRegistry,
) -> AppResult<(Driver, bool)> {
    registry
        .lock()
        .await
        .get(session_id)
        .map(|s| (s.driver.clone(), s.read_only))
        .ok_or_else(|| AppError::Internal(format!("no active session '{session_id}'")))
}

async fn open_driver(profile: &ConnectionProfile, password: Option<&str>) -> AppResult<Driver> {
    match profile.engine {
        Engine::Sqlite => open_sqlite(profile).await,
        Engine::Postgres => open_postgres(profile, password).await,
        Engine::MySql => open_mysql(profile, password).await,
    }
}

/// Bounds each engine's connect from the profile (default ~10s).
fn connect_timeout(profile: &ConnectionProfile) -> Duration {
    Duration::from_secs(
        profile
            .connect_timeout_secs
            .unwrap_or(DEFAULT_CONNECT_TIMEOUT_SECS),
    )
}

/// Wraps a network pool-open with the connect timeout, then maps the failure to
/// the specific `AppError` kind (auth vs. TLS vs. refused) the frontend renders.
async fn open_with_timeout<T>(
    timeout: Duration,
    target: &str,
    open: impl std::future::Future<Output = Result<T, sqlx::Error>>,
) -> AppResult<T> {
    tokio::time::timeout(timeout, open)
        .await
        .map_err(|_| {
            AppError::ConnectionRefused(format!(
                "connection to '{target}' timed out after {}s",
                timeout.as_secs()
            ))
        })?
        .map_err(map_connect_error)
}

/// SQLSTATE class 28 = invalid authorization (pg `28P01`, mysql `28000`), so an
/// auth failure gets its own kind; TLS handshakes get `tlsError`; everything else
/// (refused, unknown host/db, protocol) collapses to `connectionRefused`.
fn map_connect_error(err: sqlx::Error) -> AppError {
    match &err {
        sqlx::Error::Database(db) => {
            let is_auth = db.code().map(|c| c.starts_with("28")).unwrap_or(false);
            if is_auth {
                AppError::AuthFailed(db.message().to_string())
            } else {
                AppError::ConnectionRefused(db.message().to_string())
            }
        }
        sqlx::Error::Tls(_) => AppError::TlsError(err.to_string()),
        _ => AppError::ConnectionRefused(err.to_string()),
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

    let timeout = connect_timeout(profile);
    let pool = tokio::time::timeout(
        timeout,
        SqlitePoolOptions::new()
            .max_connections(POOL_MAX)
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

async fn open_postgres(profile: &ConnectionProfile, password: Option<&str>) -> AppResult<Driver> {
    use sqlx::postgres::{PgConnectOptions, PgPoolOptions, PgSslMode};

    let host = profile
        .host
        .as_deref()
        .ok_or_else(|| AppError::ConfigParse("postgres connection requires a host".into()))?;

    // No `tls` block → libpq-style `prefer` (opportunistic, no cert check).
    let ssl_mode = match profile.tls.as_ref().map(|t| t.mode) {
        None => PgSslMode::Prefer,
        Some(SslMode::Disable) => PgSslMode::Disable,
        Some(SslMode::Require) => PgSslMode::Require,
        Some(SslMode::VerifyCa) => PgSslMode::VerifyCa,
        Some(SslMode::VerifyFull) => PgSslMode::VerifyFull,
    };

    let mut options = PgConnectOptions::new().host(host).ssl_mode(ssl_mode);
    if let Some(port) = profile.port {
        options = options.port(port);
    }
    if let Some(user) = profile.username.as_deref() {
        options = options.username(user);
    }
    if let Some(db) = profile.database.as_deref() {
        options = options.database(db);
    }
    if let Some(pw) = password {
        options = options.password(pw);
    }
    if let Some(tls) = profile.tls.as_ref() {
        if let Some(ca) = tls.ca_cert_path.as_deref() {
            options = options.ssl_root_cert(ca);
        }
        if let Some(cert) = tls.client_cert_path.as_deref() {
            options = options.ssl_client_cert(cert);
        }
        if let Some(key) = tls.client_key_path.as_deref() {
            options = options.ssl_client_key(key);
        }
    }

    let pool = open_with_timeout(
        connect_timeout(profile),
        host,
        PgPoolOptions::new()
            .max_connections(POOL_MAX)
            .connect_with(options),
    )
    .await?;

    Ok(Driver::Postgres(pool))
}

async fn open_mysql(profile: &ConnectionProfile, password: Option<&str>) -> AppResult<Driver> {
    use sqlx::mysql::{MySqlConnectOptions, MySqlPoolOptions, MySqlSslMode};

    let host = profile
        .host
        .as_deref()
        .ok_or_else(|| AppError::ConfigParse("mysql connection requires a host".into()))?;

    let ssl_mode = match profile.tls.as_ref().map(|t| t.mode) {
        None => MySqlSslMode::Preferred,
        Some(SslMode::Disable) => MySqlSslMode::Disabled,
        Some(SslMode::Require) => MySqlSslMode::Required,
        Some(SslMode::VerifyCa) => MySqlSslMode::VerifyCa,
        // MySQL folds pg's "verify-full" (hostname check) into VerifyIdentity.
        Some(SslMode::VerifyFull) => MySqlSslMode::VerifyIdentity,
    };

    let mut options = MySqlConnectOptions::new().host(host).ssl_mode(ssl_mode);
    if let Some(port) = profile.port {
        options = options.port(port);
    }
    if let Some(user) = profile.username.as_deref() {
        options = options.username(user);
    }
    if let Some(db) = profile.database.as_deref() {
        options = options.database(db);
    }
    if let Some(pw) = password {
        options = options.password(pw);
    }
    if let Some(tls) = profile.tls.as_ref() {
        if let Some(ca) = tls.ca_cert_path.as_deref() {
            options = options.ssl_ca(ca);
        }
        if let Some(cert) = tls.client_cert_path.as_deref() {
            options = options.ssl_client_cert(cert);
        }
        if let Some(key) = tls.client_key_path.as_deref() {
            options = options.ssl_client_key(key);
        }
    }

    let pool = open_with_timeout(
        connect_timeout(profile),
        host,
        MySqlPoolOptions::new()
            .max_connections(POOL_MAX)
            .connect_with(options),
    )
    .await?;

    Ok(Driver::MySql(pool))
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
            environment: None,
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

    fn pg_profile(database: Option<&str>) -> ConnectionProfile {
        ConnectionProfile {
            engine: Engine::Postgres,
            host: Some("localhost".into()),
            database: database.map(str::to_owned),
            ..sqlite_profile("")
        }
    }

    #[test]
    fn a_postgres_profile_with_no_database_falls_back_to_the_maintenance_database() {
        let profile = pg_profile(None);
        assert_eq!(
            effective_profile(&profile, None).database.as_deref(),
            Some(PG_MAINTENANCE_DB)
        );
    }

    #[test]
    fn the_override_wins_over_the_profile_and_leaves_the_profile_alone() {
        let profile = pg_profile(Some("app"));
        assert_eq!(
            effective_profile(&profile, Some("reporting"))
                .database
                .as_deref(),
            Some("reporting")
        );
        assert_eq!(profile.database.as_deref(), Some("app"), "profile untouched");
    }

    // SQLite has no database name and MySQL browses every database over one
    // connection, so neither may acquire a maintenance default it would then try
    // to connect to.
    #[test]
    fn non_postgres_profiles_get_no_database_default() {
        for engine in [Engine::Sqlite, Engine::MySql] {
            let profile = ConnectionProfile {
                engine,
                ..pg_profile(None)
            };
            assert_eq!(effective_profile(&profile, None).database, None);
        }
    }

    // An empty list is the signal the tree uses to skip its database level, so
    // the non-Postgres engines returning empty is a contract, not an omission.
    #[tokio::test]
    async fn sqlite_reports_no_databases_to_browse() {
        let path = seed_db_file().await;
        let profile = sqlite_profile(&path);
        let registry: SessionRegistry = Mutex::new(HashMap::new());

        let info = connect(&profile, None, None, &registry).await.unwrap();
        assert!(list_databases(&info.session_id, &registry)
            .await
            .unwrap()
            .is_empty());

        disconnect(&info.session_id, &registry).await.unwrap();
        std::fs::remove_file(&path).ok();
    }

    #[tokio::test]
    async fn connect_introspect_disconnect_lifecycle() {
        let path = seed_db_file().await;
        let profile = sqlite_profile(&path);
        let registry: SessionRegistry = Mutex::new(HashMap::new());

        let info = connect(&profile, None, None, &registry).await.unwrap();
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
        let err = connect(&profile, None, None, &registry).await.unwrap_err();
        assert_eq!(err.kind(), "connectionRefused");
    }

    #[tokio::test]
    async fn network_engine_without_host_is_config_parse() {
        // pg/mysql require a host; the profile type makes it optional (sqlite has
        // none), so a missing host is a clear config error, not a connect attempt.
        let mut profile = sqlite_profile("/tmp/whatever.db");
        profile.engine = Engine::Postgres;
        profile.file_path = None;
        let err = test_connection(&profile, None).await.unwrap_err();
        assert_eq!(err.kind(), "configParse");
    }
}
