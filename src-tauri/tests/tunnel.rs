//! SSH tunnels against the compose `sshd` bastion, forwarding to the `postgres`
//! service by its name on the compose network. Self-skips unless both
//! `BASALT_TEST_SSH` (`user:password@host:port`) and `BASALT_TEST_PG_URL` are set.
//! Each test learns host keys into its own known_hosts, never the user's.

mod common;

use std::path::PathBuf;

use basalt_db_studio_lib::drivers::types::{SshAuthKind, SshConfig};
use basalt_db_studio_lib::services::{connection_service, query_service};
use basalt_db_studio_lib::tunnel;
use common::{profile_from_url, registry};

fn env() -> Option<(SshConfig, String, String)> {
    let ssh = std::env::var("BASALT_TEST_SSH").ok()?;
    let pg = std::env::var("BASALT_TEST_PG_URL").ok()?;
    let (auth, addr) = ssh.split_once('@')?;
    let (user, password) = auth.split_once(':')?;
    let (host, port) = addr.split_once(':')?;
    let config = SshConfig {
        host: host.into(),
        port: port.parse().ok()?,
        user: user.into(),
        auth_kind: SshAuthKind::Password,
        key_path: None,
    };
    Some((config, password.into(), pg))
}

fn known_hosts() -> PathBuf {
    std::env::temp_dir().join(format!("basalt-known-{}", uuid::Uuid::new_v4()))
}

#[tokio::test]
async fn a_query_runs_through_the_tunnel_and_the_host_key_is_learned() {
    let Some((ssh, password, pg)) = env() else {
        eprintln!("BASALT_TEST_SSH / BASALT_TEST_PG_URL unset — skipping tunnel test");
        return;
    };
    let known = known_hosts();
    let tunnel = tunnel::open_with(&ssh, Some(&password), "postgres", 5432, known.clone())
        .await
        .unwrap();
    assert!(std::fs::read_to_string(&known)
        .unwrap()
        .contains("[127.0.0.1]:2222"));

    let (mut profile, db_password) = profile_from_url(&pg);
    profile.host = Some("127.0.0.1".into());
    profile.port = Some(tunnel.local_port);
    let reg = registry();
    let sid = connection_service::connect(&profile, db_password.as_deref(), None, None, &reg)
        .await
        .unwrap()
        .session_id;
    let out = query_service::run(&sid, "SELECT 1", None, false, None, None, &reg)
        .await
        .unwrap();
    assert!(out.statements[0].error.is_none());

    // The learned key is accepted on the next connect.
    tunnel::open_with(&ssh, Some(&password), "postgres", 5432, known.clone())
        .await
        .unwrap();
    std::fs::remove_file(known).ok();
}

#[tokio::test]
async fn a_changed_host_key_is_refused() {
    let Some((ssh, password, _)) = env() else {
        return;
    };
    let known = known_hosts();
    // A valid ed25519 key that is not the bastion's.
    std::fs::write(
        &known,
        "[127.0.0.1]:2222 ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIIma0c/4bfXl+dnL9VzFOYnjJQPDEY3akT/MP9JVKH6E\n",
    )
    .unwrap();
    let err = tunnel::open_with(&ssh, Some(&password), "postgres", 5432, known.clone())
        .await
        .err()
        .expect("changed key refused");
    assert_eq!(err.kind(), "tunnelError");
    assert!(err.to_string().contains("known_hosts"), "{err}");
    std::fs::remove_file(known).ok();
}

#[tokio::test]
async fn a_wrong_password_is_a_tunnel_error() {
    let Some((ssh, _, _)) = env() else {
        return;
    };
    let err = tunnel::open_with(&ssh, Some("wrong"), "postgres", 5432, known_hosts())
        .await
        .err()
        .expect("rejected");
    assert_eq!(err.kind(), "tunnelError");
}

#[tokio::test]
async fn a_forward_the_server_refuses_fails_at_open() {
    let Some((ssh, password, _)) = env() else {
        return;
    };
    // Nothing listens there, so the server's forward fails.
    let err = tunnel::open_with(&ssh, Some(&password), "127.0.0.1", 1, known_hosts())
        .await
        .err()
        .expect("refused forward");
    assert_eq!(err.kind(), "tunnelError");
    assert!(err.to_string().contains("would not forward"), "{err}");
}
