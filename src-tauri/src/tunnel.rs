//! SSH tunnels: a local port on 127.0.0.1 forwarded through an SSH server to the
//! database, over `direct-tcpip` channels. A `Tunnel` belongs to its session and
//! closes when the session drops it.
//!
//! Host keys are checked against `~/.ssh/known_hosts`. An unknown host is learned
//! (OpenSSH's `StrictHostKeyChecking=accept-new`); a changed key is refused.

use std::path::PathBuf;
use std::sync::Arc;

use russh::client::{self, Handle};
use russh::keys::known_hosts::learn_known_hosts_path;
use russh::keys::{
    check_known_hosts_path, load_secret_key, PrivateKeyWithHashAlg, PublicKeyOrCertificate,
};
use tokio::net::TcpListener;
use tokio::task::JoinHandle;

use crate::drivers::types::{SshAuthKind, SshConfig};
use crate::{AppError, AppResult};

pub struct Tunnel {
    pub local_port: u16,
    accept: JoinHandle<()>,
}

impl Drop for Tunnel {
    // Stops accepting and drops the SSH handle with the task; connections already
    // forwarded end when the pool closes their sockets.
    fn drop(&mut self) {
        self.accept.abort();
    }
}

/// Connects and authenticates to `ssh`, then forwards a fresh local port to
/// `target_host:target_port` as the SSH server sees it. `secret` is the SSH
/// password or the key's passphrase.
pub async fn open(
    ssh: &SshConfig,
    secret: Option<&str>,
    target_host: &str,
    target_port: u16,
) -> AppResult<Tunnel> {
    let known_hosts = std::env::home_dir()
        .map(|home| home.join(".ssh").join("known_hosts"))
        .ok_or_else(|| AppError::TunnelError("no home directory for ~/.ssh/known_hosts".into()))?;
    open_with(ssh, secret, target_host, target_port, known_hosts).await
}

/// [`open`] against a given known_hosts file — the tests' own, not the user's.
pub async fn open_with(
    ssh: &SshConfig,
    secret: Option<&str>,
    target_host: &str,
    target_port: u16,
    known_hosts: PathBuf,
) -> AppResult<Tunnel> {
    let config = Arc::new(client::Config {
        nodelay: true,
        ..Default::default()
    });
    let known = KnownHosts {
        host: ssh.host.clone(),
        port: ssh.port,
        path: known_hosts,
    };
    let mut handle = client::connect(config, (ssh.host.as_str(), ssh.port), known)
        .await
        .map_err(|e| match e {
            russh::Error::UnknownKey => AppError::TunnelError(format!(
                "{}'s host key does not match ~/.ssh/known_hosts. It changed, or something \
                 is in the middle; remove the old line if the change is expected.",
                ssh.host
            )),
            e => tunnel_error(e),
        })?;
    if !authenticate(&mut handle, ssh, secret).await? {
        return Err(AppError::TunnelError(format!(
            "the SSH server rejected {}@{} ({:?} auth)",
            ssh.user, ssh.host, ssh.auth_kind
        )));
    }

    // One channel up front: a server that will not forward, or cannot reach the
    // database, fails here as a tunnel error instead of as a reset connection
    // the driver cannot explain.
    handle
        .channel_open_direct_tcpip(target_host, target_port.into(), "127.0.0.1", 0)
        .await
        .map_err(|e| {
            AppError::TunnelError(format!(
                "{} would not forward to {target_host}:{target_port} ({e}); check \
                 AllowTcpForwarding on the server and the database address as it sees it",
                ssh.host
            ))
        })?;

    let listener = TcpListener::bind(("127.0.0.1", 0))
        .await
        .map_err(tunnel_error)?;
    let local_port = listener.local_addr().map_err(tunnel_error)?.port();
    let handle = Arc::new(handle);
    let target_host = target_host.to_owned();
    let accept = tokio::spawn(async move {
        while let Ok((mut socket, peer)) = listener.accept().await {
            let handle = handle.clone();
            let target_host = target_host.clone();
            tokio::spawn(async move {
                let channel = handle
                    .channel_open_direct_tcpip(
                        target_host,
                        target_port.into(),
                        peer.ip().to_string(),
                        peer.port().into(),
                    )
                    .await;
                match channel {
                    Ok(channel) => {
                        let _ =
                            tokio::io::copy_bidirectional(&mut socket, &mut channel.into_stream())
                                .await;
                    }
                    Err(e) => tracing::warn!("ssh tunnel channel refused: {e}"),
                }
            });
        }
    });
    Ok(Tunnel { local_port, accept })
}

async fn authenticate(
    handle: &mut Handle<KnownHosts>,
    ssh: &SshConfig,
    secret: Option<&str>,
) -> AppResult<bool> {
    let user = ssh.user.as_str();
    let result = match ssh.auth_kind {
        SshAuthKind::Password => handle
            .authenticate_password(user, secret.unwrap_or_default())
            .await
            .map_err(tunnel_error)?,
        SshAuthKind::Key => {
            let path = ssh.key_path.as_deref().ok_or_else(|| {
                AppError::TunnelError("key authentication needs a private key file".into())
            })?;
            let key = load_secret_key(expand_home(path), secret).map_err(tunnel_error)?;
            let hash = handle
                .best_supported_rsa_hash()
                .await
                .map_err(tunnel_error)?
                .flatten();
            handle
                .authenticate_publickey(user, PrivateKeyWithHashAlg::new(Arc::new(key), hash))
                .await
                .map_err(tunnel_error)?
        }
        SshAuthKind::Agent => return agent(handle, user).await,
    };
    Ok(result.success())
}

/// Offers each identity the running agent holds until the server takes one.
async fn agent(handle: &mut Handle<KnownHosts>, user: &str) -> AppResult<bool> {
    use russh::keys::agent::client::AgentClient;

    #[cfg(unix)]
    let mut agent = AgentClient::connect_env().await.map_err(tunnel_error)?;
    // The Windows OpenSSH agent's well-known pipe.
    #[cfg(windows)]
    let mut agent = AgentClient::connect_named_pipe(r"\\.\pipe\openssh-ssh-agent")
        .await
        .map_err(tunnel_error)?;

    let hash = handle
        .best_supported_rsa_hash()
        .await
        .map_err(tunnel_error)?
        .flatten();
    for identity in agent.request_identities().await.map_err(tunnel_error)? {
        let result = handle
            .authenticate_publickey_with(user, identity.public_key().into_owned(), hash, &mut agent)
            .await
            .map_err(tunnel_error)?;
        if result.success() {
            return Ok(true);
        }
    }
    Ok(false)
}

/// `~/` in a key path, as every SSH tool accepts it.
fn expand_home(path: &str) -> PathBuf {
    match (path.strip_prefix("~/"), std::env::home_dir()) {
        (Some(rest), Some(home)) => home.join(rest),
        _ => PathBuf::from(path),
    }
}

fn tunnel_error(e: impl std::fmt::Display) -> AppError {
    AppError::TunnelError(e.to_string())
}

struct KnownHosts {
    host: String,
    port: u16,
    path: PathBuf,
}

impl client::Handler for KnownHosts {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        key: &PublicKeyOrCertificate,
    ) -> Result<bool, Self::Error> {
        // ponytail: host certificates are refused; accept them against a CA line
        // in known_hosts if a user ever needs it.
        let PublicKeyOrCertificate::PublicKey { key, .. } = key else {
            return Ok(false);
        };
        match check_known_hosts_path(&self.host, self.port, key, &self.path) {
            Ok(true) => Ok(true),
            Ok(false) => {
                if let Err(e) = learn_known_hosts_path(&self.host, self.port, key, &self.path) {
                    tracing::warn!("could not record {}'s host key: {e}", self.host);
                }
                Ok(true)
            }
            Err(_) => Ok(false),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_tilde_key_path_resolves_under_home() {
        let home = std::env::home_dir().unwrap();
        assert_eq!(
            expand_home("~/.ssh/id_ed25519"),
            home.join(".ssh/id_ed25519")
        );
        assert_eq!(expand_home("/etc/key"), PathBuf::from("/etc/key"));
    }
}
