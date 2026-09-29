//! Saved passwords, in the OS credential store (macOS Keychain, Windows
//! Credential Manager, Secret Service) — never in the config dir. One entry per
//! profile: service `basalt-db-studio`, account = the profile's `secret_ref`,
//! secret = a JSON [`Secret`].
//!
//! Entries go through `keyring_core` rather than `keyring`'s own `Entry`, so a
//! test can install keyring-core's mock store in place of the platform one.

use keyring_core::{Entry, Error};
use serde::{Deserialize, Serialize};

use crate::config::connections::ConnectionProfile;
use crate::{AppError, AppResult};

const SERVICE: &str = "basalt-db-studio";

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Secret {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub password: Option<String>,
    /// The SSH key passphrase, or the SSH password, for the tunnel.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ssh: Option<String>,
}

/// Selects the platform store. A platform without one surfaces as
/// `keychainUnavailable` on first use rather than failing startup.
pub fn init() {
    if let Err(e) = keyring::Entry::store_status() {
        tracing::warn!("no OS credential store: {e}");
    }
}

/// The profile's saved secret, if it has one.
pub fn load(profile: &ConnectionProfile) -> AppResult<Option<Secret>> {
    let Some(secret_ref) = profile.secret_ref.as_deref() else {
        return Ok(None);
    };
    match entry(secret_ref)?.get_password() {
        Ok(json) => serde_json::from_str(&json)
            .map(Some)
            .map_err(AppError::internal),
        Err(Error::NoEntry) => Err(AppError::SecretNotFound(format!(
            "no saved password for “{}” in the OS credential store",
            profile.name
        ))),
        Err(e) => Err(unavailable(e)),
    }
}

/// Brings the stored secret in line with the form before the profile is saved.
/// `remember` off forgets it; on, a field that is `Some` replaces what is stored
/// and one that is `None` keeps it — a blank password field on edit means
/// "keep the saved one".
pub fn apply(profile: &mut ConnectionProfile, secret: Secret, remember: bool) -> AppResult<()> {
    if !remember {
        forget(profile)?;
        profile.secret_ref = None;
        return Ok(());
    }
    let mut stored = match load(profile) {
        Ok(stored) => stored.unwrap_or_default(),
        Err(AppError::SecretNotFound(_)) => Secret::default(),
        Err(e) => return Err(e),
    };
    stored.password = secret.password.or(stored.password);
    stored.ssh = secret.ssh.or(stored.ssh);
    let secret_ref = profile
        .secret_ref
        .get_or_insert_with(|| uuid::Uuid::new_v4().to_string());
    let json = serde_json::to_string(&stored).map_err(AppError::internal)?;
    entry(secret_ref)?.set_password(&json).map_err(unavailable)
}

/// Deletes the profile's saved secret; nothing saved is not an error.
pub fn forget(profile: &ConnectionProfile) -> AppResult<()> {
    let Some(secret_ref) = profile.secret_ref.as_deref() else {
        return Ok(());
    };
    match entry(secret_ref)?.delete_credential() {
        Ok(()) | Err(Error::NoEntry) => Ok(()),
        Err(e) => Err(unavailable(e)),
    }
}

fn entry(secret_ref: &str) -> AppResult<Entry> {
    Entry::new(SERVICE, secret_ref).map_err(unavailable)
}

/// Every store failure the user can act on is the same one: the store is not
/// there or would not let us in. The password prompt is the way forward for all.
fn unavailable(e: Error) -> AppError {
    AppError::KeychainUnavailable(e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::drivers::types::Engine;

    fn profile() -> ConnectionProfile {
        ConnectionProfile {
            id: uuid::Uuid::new_v4().to_string(),
            name: "warehouse".into(),
            engine: Engine::Postgres,
            environment: None,
            host: Some("db".into()),
            port: None,
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

    fn secret(password: &str) -> Secret {
        Secret {
            password: Some(password.into()),
            ssh: None,
        }
    }

    /// The default store is process-wide and tests run in parallel, so it is
    /// installed once; each test works under its own random `secret_ref`.
    fn mock() {
        static INSTALL: std::sync::Once = std::sync::Once::new();
        INSTALL.call_once(|| {
            keyring_core::set_default_store(keyring_core::mock::Store::new().unwrap())
        });
    }

    #[test]
    fn a_remembered_password_round_trips_and_a_blank_keeps_it() {
        mock();
        let mut p = profile();
        apply(&mut p, secret("hunter2"), true).unwrap();
        assert!(p.secret_ref.is_some());
        assert_eq!(
            load(&p).unwrap().unwrap().password.as_deref(),
            Some("hunter2")
        );

        apply(&mut p, Secret::default(), true).unwrap();
        assert_eq!(
            load(&p).unwrap().unwrap().password.as_deref(),
            Some("hunter2")
        );
    }

    #[test]
    fn not_remembering_forgets_the_secret_and_the_ref() {
        mock();
        let mut p = profile();
        apply(&mut p, secret("hunter2"), true).unwrap();
        let old = p.clone();
        apply(&mut p, Secret::default(), false).unwrap();
        assert_eq!(p.secret_ref, None);
        assert_eq!(load(&old).unwrap_err().kind(), "secretNotFound");
    }

    #[test]
    fn a_ref_with_nothing_behind_it_is_secret_not_found() {
        mock();
        let mut p = profile();
        p.secret_ref = Some(uuid::Uuid::new_v4().to_string());
        assert_eq!(load(&p).unwrap_err().kind(), "secretNotFound");
        forget(&p).unwrap();
    }

    // The spec's leak gate: a remembered password lives in the store, and no file
    // the config writers produce ever carries it.
    #[test]
    fn a_saved_connection_leaves_no_plaintext_in_the_config_dir() {
        mock();
        let paths = crate::config::Paths::under(
            std::env::temp_dir().join(format!("basalt-leak-{}", uuid::Uuid::new_v4())),
        );
        let mut p = profile();
        apply(&mut p, secret("sentinel-9f3c"), true).unwrap();
        crate::config::connections::save(&paths, &p).unwrap();

        let text = std::fs::read_to_string(&paths.connections_file).unwrap();
        assert!(!text.contains("sentinel-9f3c"), "{text}");
        assert!(text.contains(p.secret_ref.as_deref().unwrap()));

        std::fs::remove_dir_all(&paths.config_dir).ok();
    }
}
