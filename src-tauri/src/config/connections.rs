//! Connection profiles: every saved connection in one `connections.toml` under
//! the app config dir. The profile has **no password field by construction** — only
//! a `secret_ref` UUID into the SecretStore — so a secret written to disk is a
//! type error, not a review catch. The same struct is the wire type (`invoke` payload) and
//! the file format; `tls`/`ssh` are declared last so their `[tls]`/`[ssh]` tables
//! never precede a scalar in the emitted TOML.

use std::fs;

use serde::{Deserialize, Serialize};

use crate::config::Paths;
use crate::drivers::types::{Engine, SshConfig, TlsConfig};
use crate::{AppError, AppResult};

/// Which deployment a profile points at. Carried in the profile, so every
/// surface that names the connection can show the same `prod` warning.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Environment {
    Local,
    Staging,
    Prod,
}

/// A saved connection. Contains no secret material.
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

/// The on-disk shape of `connections.toml`: one `[[connection]]` table per profile.
#[derive(Serialize, Deserialize, Default)]
struct ConnectionsFile {
    #[serde(default, rename = "connection")]
    connections: Vec<ConnectionProfile>,
}

pub fn load_all(paths: &Paths) -> AppResult<Vec<ConnectionProfile>> {
    adopt_legacy_dir(paths)?;
    let mut profiles = read(paths)?;
    // Stable, human-meaningful order for the panel; ids are opaque UUIDs.
    profiles.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(profiles)
}

pub fn load_one(paths: &Paths, id: &str) -> AppResult<ConnectionProfile> {
    load_all(paths)?
        .into_iter()
        .find(|p| p.id == id)
        .ok_or_else(|| AppError::ConfigIo(format!("connection '{id}' is not in connections.toml")))
}

pub fn save(paths: &Paths, profile: &ConnectionProfile) -> AppResult<()> {
    let mut profiles = load_all(paths)?;
    match profiles.iter_mut().find(|p| p.id == profile.id) {
        Some(existing) => *existing = profile.clone(),
        None => profiles.push(profile.clone()),
    }
    write(paths, profiles)
}

pub fn delete(paths: &Paths, id: &str) -> AppResult<()> {
    let mut profiles = load_all(paths)?;
    profiles.retain(|p| p.id != id);
    write(paths, profiles)
}

fn read(paths: &Paths) -> AppResult<Vec<ConnectionProfile>> {
    let text = match fs::read_to_string(&paths.connections_file) {
        Ok(text) => text,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(e) => return Err(io_err(e)),
    };
    let file: ConnectionsFile = toml::from_str(&text)
        .map_err(|e| AppError::ConfigParse(format!("{}: {e}", paths.connections_file.display())))?;
    Ok(file.connections)
}

/// Writes through a sibling temp file and a rename, so a crash mid-write leaves
/// the previous file intact — every saved connection lives in this one file.
fn write(paths: &Paths, connections: Vec<ConnectionProfile>) -> AppResult<()> {
    fs::create_dir_all(&paths.config_dir).map_err(io_err)?;
    let text =
        toml::to_string_pretty(&ConnectionsFile { connections }).map_err(AppError::internal)?;
    let tmp = paths.connections_file.with_extension("toml.tmp");
    fs::write(&tmp, text).map_err(io_err)?;
    fs::rename(&tmp, &paths.connections_file).map_err(io_err)
}

/// Folds the old one-file-per-profile `connections/` directory into
/// `connections.toml`, then removes it.
// ponytail: one-time migration; delete once no pre-0.2 install remains.
fn adopt_legacy_dir(paths: &Paths) -> AppResult<()> {
    let legacy = paths.config_dir.join("connections");
    if paths.connections_file.exists() || !legacy.is_dir() {
        return Ok(());
    }
    let mut profiles = Vec::new();
    for entry in fs::read_dir(&legacy).map_err(io_err)? {
        let path = entry.map_err(io_err)?.path();
        if path.extension().and_then(|e| e.to_str()) != Some("toml") {
            continue;
        }
        let text = fs::read_to_string(&path).map_err(io_err)?;
        profiles.push(
            toml::from_str(&text)
                .map_err(|e| AppError::ConfigParse(format!("{}: {e}", path.display())))?,
        );
    }
    write(paths, profiles)?;
    fs::remove_dir_all(&legacy).map_err(io_err)
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
    // Those must keep loading, and must not be silently relabelled — an untagged
    // connection is untagged, not "local".
    #[test]
    fn profiles_without_an_environment_still_load_untagged() {
        let paths = temp_paths();
        fs::create_dir_all(&paths.config_dir).unwrap();
        let id = "33333333-3333-4333-8333-333333333333";
        fs::write(
            &paths.connections_file,
            format!("[[connection]]\nid = \"{id}\"\nname = \"Legacy\"\nengine = \"postgres\"\nreadOnly = false\n"),
        )
        .unwrap();

        let loaded = load_one(&paths, id).unwrap();
        assert_eq!(loaded.environment, None);

        fs::remove_dir_all(&paths.config_dir).ok();
    }

    // The tag is only useful if it survives a TOML write and re-read — so assert
    // it lands in the file, not just in memory.
    #[test]
    fn environment_is_written_to_the_connections_file() {
        let paths = temp_paths();
        let profile = mysql_profile("44444444-4444-4444-8444-444444444444", "Staging");
        save(&paths, &profile).unwrap();

        let raw = fs::read_to_string(&paths.connections_file).unwrap();
        assert!(raw.contains("environment = \"staging\""), "got: {raw}");
        assert_eq!(load_one(&paths, &profile.id).unwrap(), profile);

        fs::remove_dir_all(&paths.config_dir).ok();
    }

    #[test]
    fn saving_an_existing_id_replaces_it_in_place() {
        let paths = temp_paths();
        let id = "55555555-5555-4555-8555-555555555555";
        save(&paths, &mysql_profile(id, "Before")).unwrap();
        save(&paths, &mysql_profile(id, "After")).unwrap();

        let loaded = load_all(&paths).unwrap();
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].name, "After");

        fs::remove_dir_all(&paths.config_dir).ok();
    }

    #[test]
    fn a_legacy_connections_dir_is_folded_into_the_file() {
        let paths = temp_paths();
        let legacy = paths.config_dir.join("connections");
        fs::create_dir_all(&legacy).unwrap();
        let profile = mysql_profile("66666666-6666-4666-8666-666666666666", "Old layout");
        fs::write(
            legacy.join(format!("{}.toml", profile.id)),
            toml::to_string_pretty(&profile).unwrap(),
        )
        .unwrap();

        assert_eq!(load_all(&paths).unwrap(), vec![profile]);
        assert!(!legacy.exists());
        assert!(paths.connections_file.exists());

        fs::remove_dir_all(&paths.config_dir).ok();
    }

    #[test]
    fn load_all_of_missing_file_is_empty() {
        let paths = temp_paths();
        assert!(load_all(&paths).unwrap().is_empty());
    }

    #[test]
    fn load_one_of_an_unknown_id_is_a_config_error() {
        let paths = temp_paths();
        assert_eq!(load_one(&paths, "nope").unwrap_err().kind(), "configIo");
    }

    fn mysql_profile(id: &str, name: &str) -> ConnectionProfile {
        ConnectionProfile {
            id: id.into(),
            name: name.into(),
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
        }
    }
}
