//! Creating the repo on GitHub, through the GitHub CLI.
//!
//! `git init` makes a repo here; `git push` needs one to already exist there.
//! Closing that gap needs a GitHub *account*, which git does not have and this
//! app deliberately does not hold — so it borrows `gh`'s, the same way it borrows
//! the credential helper's for pushing. `gh` keeps its own OAuth token in the OS
//! keychain, so Basalt still stores nothing and still has no sign-in of its own.
//!
//! `gh auth login` is interactive and is never run from here. When `gh` is
//! missing or signed out the panel says so and does not offer the button, which
//! is why `status` exists separately from `publish`.

use std::path::Path;

use serde::Serialize;

use super::{ops, process, stderr, stdout};
use crate::{AppError, AppResult};

/// Creating a repo is a round trip to GitHub; the local timeout is too tight and
/// the network one is longer than this ever legitimately takes.
const GH_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(60);

#[derive(Serialize, Default, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GithubStatus {
    pub installed: bool,
    /// `gh auth status` succeeded — there is a usable token in gh's own store.
    pub authenticated: bool,
    /// The account gh is signed in as, so the panel can name it before creating
    /// a repo under it. Nobody wants to discover afterwards that it went to a
    /// work account.
    pub login: Option<String>,
}

pub fn github_status(dir: &Path) -> AppResult<GithubStatus> {
    // `--active` prints just the logged-in account for the current host, which is
    // both the check and the name in one call.
    let Ok(out) = process::run_in("gh", dir, &["auth", "status", "--active"], GH_TIMEOUT) else {
        return Ok(GithubStatus::default());
    };
    if out.timed_out {
        return Ok(GithubStatus {
            installed: true,
            ..Default::default()
        });
    }
    if !out.success() {
        // gh ran and said no: installed, signed out.
        return Ok(GithubStatus {
            installed: true,
            authenticated: false,
            login: None,
        });
    }

    Ok(GithubStatus {
        installed: true,
        authenticated: true,
        login: parse_login(&stdout(&out)),
    })
}

/// gh prints `✓ Logged in to github.com account octocat (keyring)`. The account
/// is the word after `account`; anything else about the line is gh's to change.
fn parse_login(text: &str) -> Option<String> {
    text.split_whitespace()
        .skip_while(|w| *w != "account")
        .nth(1)
        .map(str::to_string)
        .filter(|name| !name.is_empty())
}

/// Create `name` on GitHub, point `origin` at it, and push.
///
/// Private by default and not offered as a choice: this repo holds connection
/// profiles — hostnames, ports, usernames, database names. None of it is a
/// secret by construction, and all of it is a map of someone's infrastructure.
/// A public default would be a footgun aimed at exactly the users this feature
/// is for.
pub fn github_publish(dir: &Path, name: &str) -> AppResult<()> {
    let status = github_status(dir)?;
    if !status.installed || !status.authenticated {
        return Err(AppError::GithubCliUnavailable(if status.installed {
            "the GitHub CLI is installed but signed out".into()
        } else {
            "the GitHub CLI (gh) is not installed or not on PATH".into()
        }));
    }

    // `--source=.` makes gh add the remote for us; we push separately so the
    // first push goes through the same path as every later one — including
    // setting the upstream and classifying a credential failure.
    let out = process::run_in(
        "gh",
        dir,
        &["repo", "create", name, "--private", "--source=.", "--remote=origin"],
        GH_TIMEOUT,
    )?;

    if !out.success() {
        return Err(create_error(&out));
    }
    ops::push(dir)
}

fn create_error(out: &super::GitOutput) -> AppError {
    if out.timed_out {
        return AppError::internal("gh repo create did not finish in time");
    }
    let raw = stderr(out);
    let lower = raw.to_lowercase();

    // The likeliest failure by far, and the only one the user fixes by typing
    // something different rather than by going somewhere else.
    if lower.contains("name already exists") || lower.contains("already exists on this account") {
        return AppError::GithubRepoExists(
            "a repository with that name already exists on this account".into(),
        );
    }
    if lower.contains("authentication") || lower.contains("not logged into") {
        return AppError::GithubCliUnavailable("the GitHub CLI rejected the request".into());
    }
    AppError::internal(format!("gh repo create failed: {raw}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_the_account_out_of_gh_auth_status() {
        let text = "github.com\n  ✓ Logged in to github.com account octocat (keyring)\n  \
                    - Active account: true";
        assert_eq!(parse_login(text).as_deref(), Some("octocat"));
    }

    // gh is free to reword this; a missing name is not a reason to refuse to
    // report that the user is signed in.
    #[test]
    fn survives_output_without_an_account_word() {
        assert_eq!(parse_login("✓ Logged in to github.com"), None);
        assert_eq!(parse_login(""), None);
    }
}
