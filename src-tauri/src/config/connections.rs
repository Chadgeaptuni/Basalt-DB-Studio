//! Connection profiles: one `<id>.toml` file per connection under
//! `connections/`. The profile has **no password field by construction** — only
//! a `secret_ref` UUID into the SecretStore — so a leak into git is a type error,
//! not a review catch. The same struct is the wire type (`invoke` payload) and
//! the file format; `tls`/`ssh` are declared last so their `[tls]`/`[ssh]` tables
//! never precede a scalar in the emitted TOML.

use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::config::Paths;
use crate::drivers::types::{Engine, SshConfig, TlsConfig};
use crate::{AppError, AppResult};

/// Which deployment a profile points at. Carried in the profile — and therefore
/// git-synced with it — so a teammate who pulls the shared connection sees the
/// same `prod` warning without having to re-tag it locally.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Environment {
    Local,
    Staging,
    Prod,
}

/// A saved connection. Git-syncable; contains no secret material.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionProfile {
    pub id: String,
    pub name: String,
    pub engine: Engine,
    /// Absent in profiles written before environments existed, and left absent
    /// rather than defaulted: guessing `local` for an untagged profile would put
    /// a reassuring badge on a connection nobody has actually classified.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub environment: Option<Environment>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub host: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub port: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub database: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub username: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_path: Option<String>,
    pub read_only: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub connect_timeout_secs: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub secret_ref: Option<String>,
    // Nested tables last so TOML stays valid (a table may not precede a scalar).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tls: Option<TlsConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ssh: Option<SshConfig>,
}

pub fn load_all(paths: &Paths) -> AppResult<Vec<ConnectionProfile>> {
    if !paths.connections_dir.exists() {
        return Ok(Vec::new());
    }

    let mut profiles = Vec::new();
    for entry in fs::read_dir(&paths.connections_dir).map_err(io_err)? {
        let path = entry.map_err(io_err)?.path();
        if path.extension().and_then(|e| e.to_str()) != Some("toml") {
            continue;
        }
        let text = fs::read_to_string(&path).map_err(io_err)?;
        let profile: ConnectionProfile = toml::from_str(&text)
            .map_err(|e| AppError::ConfigParse(format!("{}: {e}", path.display())))?;
        profiles.push(profile);
    }

    // Stable, human-meaningful order for the sidebar; ids are opaque UUIDs.
    profiles.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(profiles)
}

pub fn load_one(paths: &Paths, id: &str) -> AppResult<ConnectionProfile> {
    let path = profile_path(paths, id)?;
    let text = fs::read_to_string(&path)
        .map_err(|e| AppError::ConfigIo(format!("connection '{id}': {e}")))?;
    toml::from_str(&text).map_err(|e| AppError::ConfigParse(format!("connection '{id}': {e}")))
}

pub fn save(paths: &Paths, profile: &ConnectionProfile) -> AppResult<()> {
    let path = profile_path(paths, &profile.id)?;
    fs::create_dir_all(&paths.connections_dir).map_err(io_err)?;
    let text = toml::to_string_pretty(profile).map_err(AppError::internal)?;
    fs::write(&path, text).map_err(io_err)
}

pub fn delete(paths: &Paths, id: &str) -> AppResult<()> {
    let path = profile_path(paths, id)?;
    if path.exists() {
        fs::remove_file(&path).map_err(io_err)?;
    }
    Ok(())
}

/// Maps an id to its file, rejecting anything that could escape `connections/`.
/// Profile ids are opaque UUIDs (hex + hyphens), so disallowing separators and
/// dots is both safe and sufficient.
fn profile_path(paths: &Paths, id: &str) -> AppResult<PathBuf> {
    if id.is_empty() || id.contains(['/', '\\', '.']) {
        return Err(AppError::ConfigParse(format!(
            "invalid connection id: '{id}'"
        )));
    }
    Ok(paths.connections_dir.join(format!("{id}.toml")))
}

fn io_err(e: std::io::Error) -> AppError {
    AppError::ConfigIo(e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::drivers::types::{SshAuthKind, SslMode};

    fn temp_paths() -> Paths {
        Paths::under(std::env::temp_dir().join(format!("basalt-cfg-{}", uuid::Uuid::new_v4())))
    }

    #[test]
    fn save_then_load_all_round_trips_including_nested_tables() {
        let paths = temp_paths();

        let sqlite = ConnectionProfile {
            id: "11111111-1111-4111-8111-111111111111".into(),
            name: "Local SQLite".into(),
            engine: Engine::Sqlite,
            environment: Some(Environment::Local),
            host: None,
            port: None,
            database: None,
            username: None,
            file_path: Some("/data/app.db".into()),
            read_only: true,
            connect_timeout_secs: Some(15),
            secret_ref: None,
            tls: None,
            ssh: None,
        };
        let pg = ConnectionProfile {
            id: "22222222-2222-4222-8222-222222222222".into(),
            name: "Prod Postgres".into(),
            engine: Engine::Postgres,
            environment: Some(Environment::Prod),
            host: Some("db.example.com".into()),
            port: Some(5432),
            database: Some("app".into()),
            username: Some("app_ro".into()),
            file_path: None,
            read_only: false,
            connect_timeout_secs: None,
            secret_ref: Some("secret-uuid".into()),
            tls: Some(TlsConfig {
                mode: SslMode::VerifyFull,
                ca_cert_path: Some("/etc/ssl/ca.pem".into()),
                client_cert_path: None,
                client_key_path: None,
            }),
            ssh: Some(SshConfig {
                host: "bastion".into(),
                port: 22,
                user: "deploy".into(),
                auth_kind: SshAuthKind::Key,
                key_path: Some("/home/u/.ssh/id_ed25519".into()),
            }),
        };

        save(&paths, &sqlite).unwrap();
        save(&paths, &pg).unwrap();

        // load_all sorts by name: "Local SQLite" < "Prod Postgres".
        let loaded = load_all(&paths).unwrap();
        assert_eq!(loaded, vec![sqlite.clone(), pg.clone()]);
        assert_eq!(load_one(&paths, &pg.id).unwrap(), pg);

        delete(&paths, &sqlite.id).unwrap();
        assert_eq!(load_all(&paths).unwrap(), vec![pg]);

        fs::remove_dir_all(&paths.config_dir).ok();
    }

    // Every profile written before environments existed has no `environment` key.
    // Those files must keep loading, and must not be silently relabelled — an
    // untagged connection is untagged, not "local".
    #[test]
    fn profiles_without_an_environment_still_load_untagged() {
        let paths = temp_paths();
        fs::create_dir_all(&paths.connections_dir).unwrap();
        let id = "33333333-3333-4333-8333-333333333333";
        fs::write(
            paths.connections_dir.join(format!("{id}.toml")),
            format!(
                "id = \"{id}\"\nname = \"Legacy\"\nengine = \"postgres\"\nreadOnly = false\n"
            ),
        )
        .unwrap();

        let loaded = load_one(&paths, id).unwrap();
        assert_eq!(loaded.environment, None);

        fs::remove_dir_all(&paths.config_dir).ok();
    }

    // The tag is only useful if it survives the git-sync round trip, which is a
    // TOML write and re-read — so assert it lands in the file, not just in memory.
    #[test]
    fn environment_is_written_to_the_profile_file() {
        let paths = temp_paths();
        let profile = ConnectionProfile {
            id: "44444444-4444-4444-8444-444444444444".into(),
            name: "Staging".into(),
            engine: Engine::MySql,
            environment: Some(Environment::Staging),
            host: Some("stage.internal".into()),
            port: Some(3306),
            database: None,
            username: None,
            file_path: None,
            read_only: false,
            connect_timeout_secs: None,
            secret_ref: None,
            tls: None,
            ssh: None,
        };
        save(&paths, &profile).unwrap();

        let raw = fs::read_to_string(profile_path(&paths, &profile.id).unwrap()).unwrap();
        assert!(raw.contains("environment = \"staging\""), "got: {raw}");
        assert_eq!(load_one(&paths, &profile.id).unwrap(), profile);

        fs::remove_dir_all(&paths.config_dir).ok();
    }

    #[test]
    fn load_all_of_missing_dir_is_empty() {
        let paths = temp_paths();
        assert!(load_all(&paths).unwrap().is_empty());
    }

    #[test]
    fn path_traversal_ids_are_rejected() {
        let paths = temp_paths();
        assert_eq!(
            profile_path(&paths, "../evil").unwrap_err().kind(),
            "configParse"
        );
        assert_eq!(profile_path(&paths, "").unwrap_err().kind(), "configParse");
    }
}
