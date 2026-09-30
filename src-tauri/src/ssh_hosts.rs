//! The hosts saved in `~/.ssh/config`, offered by the connection form so a tunnel
//! can start from one instead of being retyped. Only the alias list is read here;
//! OpenSSH resolves each alias (`ssh -G`), so defaults, wildcards, `Include` and
//! `Match` apply exactly as they do for `ssh <alias>`.

use std::collections::HashSet;
use std::process::{Command, Stdio};

use serde::Serialize;

use crate::drivers::types::{SshAuthKind, SshConfig};
use crate::tunnel::expand_home;

#[derive(Serialize, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SshHost {
    pub alias: String,
    pub ssh: SshConfig,
    /// The first `LocalForward`'s target: the database as the SSH server sees it.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub forward: Option<Forward>,
}

#[derive(Serialize, Debug, PartialEq, Eq)]
pub struct Forward {
    pub host: String,
    pub port: u16,
}

/// No config file or no `ssh` binary is an empty list: the form then has only
/// its typed fields.
pub fn list() -> Vec<SshHost> {
    let Some(config) = std::env::home_dir()
        .and_then(|home| std::fs::read_to_string(home.join(".ssh").join("config")).ok())
    else {
        return Vec::new();
    };
    aliases(&config)
        .into_iter()
        .filter_map(|alias| resolve(alias, &dump(alias)?))
        .collect()
}

fn dump(alias: &str) -> Option<String> {
    let mut ssh = Command::new("ssh");
    // `--`: an alias is never read as an option.
    ssh.args(["-G", "--", alias]).stdin(Stdio::null());
    // A console program started from a GUI one opens a console window on Windows.
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        ssh.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    let out = ssh.output().ok()?;
    out.status
        .success()
        .then(|| String::from_utf8_lossy(&out.stdout).into_owned())
}

/// Each name on a `Host` line, once, in file order. Patterns (`*`, `?`) and
/// negations name no single host.
// ponytail: `Include`d files are not scanned for aliases; read them here if a
// user keeps hosts there.
fn aliases(config: &str) -> Vec<&str> {
    let separator = |c: char| c.is_whitespace() || c == '=';
    let mut seen = HashSet::new();
    config
        .lines()
        .filter_map(|line| {
            let (key, names) = line.trim_start().split_once(separator)?;
            key.eq_ignore_ascii_case("host").then_some(names)
        })
        .flat_map(|names| names.split(separator))
        .filter(|name| !name.is_empty() && !name.contains(['*', '?', '!']))
        .filter(|name| seen.insert(*name))
        .collect()
}

/// `ssh -G`'s dump as a tunnel: key auth with the first identity file that
/// exists, the agent otherwise. A host behind a jump is left out, since the
/// tunnel dials its SSH server directly.
// ponytail: no ProxyJump; open the jump's `direct-tcpip` channel and run the
// second SSH session over it if a user needs one.
fn resolve(alias: &str, dump: &str) -> Option<SshHost> {
    let (mut host, mut user, mut port, mut key, mut forward) = (None, None, 22, None, None);
    for line in dump.lines() {
        let Some((name, value)) = line.split_once(' ') else {
            continue;
        };
        match name {
            "hostname" => host = Some(value),
            "user" => user = Some(value),
            "port" => port = value.parse().ok()?,
            "identityfile" if key.is_none() && expand_home(value).exists() => key = Some(value),
            "localforward" if forward.is_none() => forward = local_forward_target(value),
            "proxyjump" | "proxycommand" if value != "none" => return None,
            _ => {}
        }
    }
    Some(SshHost {
        alias: alias.to_owned(),
        ssh: SshConfig {
            host: host?.to_owned(),
            port,
            user: user?.to_owned(),
            auth_kind: if key.is_some() { SshAuthKind::Key } else { SshAuthKind::Agent },
            key_path: key.map(str::to_owned),
        },
        forward,
    })
}

/// `15432 [db.internal]:5432` → `db.internal:5432`. A Unix-socket target has no
/// port and is no database address the form can hold.
fn local_forward_target(value: &str) -> Option<Forward> {
    let (host, port) = value.split_whitespace().nth(1)?.rsplit_once(':')?;
    Some(Forward {
        host: host.trim_matches(['[', ']']).to_owned(),
        port: port.parse().ok()?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lists_each_concrete_alias_once_in_file_order() {
        let config = "Host=web db\n  HostName web.example.com\n\
                      host db *.internal !legacy\n# Host commented\nHost = spaced\n";
        assert_eq!(aliases(config), ["web", "db", "spaced"]);
    }

    // The shape OpenSSH 10's `ssh -G` prints.
    #[test]
    fn a_host_with_a_key_and_a_forward_fills_the_tunnel_and_the_database() {
        let key = std::env::temp_dir().join("basalt-ssh-hosts-test-key");
        std::fs::write(&key, "").unwrap();
        let dump = format!(
            "user deploy\nhostname bastion.example.com\nport 2222\n\
             localforward 15432 [db.internal]:5432\n\
             identityfile ~/.ssh/basalt_absent_key\nidentityfile {}\n",
            key.display()
        );
        let host = resolve("staging", &dump).unwrap();
        std::fs::remove_file(&key).unwrap();

        assert_eq!(
            host,
            SshHost {
                alias: "staging".into(),
                ssh: SshConfig {
                    host: "bastion.example.com".into(),
                    port: 2222,
                    user: "deploy".into(),
                    auth_kind: SshAuthKind::Key,
                    key_path: Some(key.display().to_string()),
                },
                forward: Some(Forward {
                    host: "db.internal".into(),
                    port: 5432
                }),
            }
        );
    }

    #[test]
    fn a_host_without_a_key_file_uses_the_agent() {
        let dump = "user deploy\nhostname bastion.example.com\nport 22\n\
                    identityfile ~/.ssh/basalt_absent_key\n";
        let host = resolve("staging", dump).unwrap();
        assert_eq!(host.ssh.auth_kind, SshAuthKind::Agent);
        assert_eq!(host.ssh.key_path, None);
        assert_eq!(host.forward, None);
    }

    #[test]
    fn a_host_behind_a_jump_is_left_out() {
        let dump = "user deploy\nhostname db.example.com\nport 22\n\
                    proxyjump bastion.example.com\n";
        assert_eq!(resolve("inner", dump), None);
    }
}
