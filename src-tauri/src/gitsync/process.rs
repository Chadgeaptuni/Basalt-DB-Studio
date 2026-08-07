//! The one place a subprocess is spawned. Everything about *running* git lives
//! here so the operations above can be about git and not about process handling.

use std::io::Read;
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::OnceLock;
use std::thread;
use std::time::{Duration, Instant};

use crate::{AppError, AppResult};

/// `git restore` is the floor: it is what `unstage` and `discard` are built on,
/// and it landed in 2.23. Below that they fail with git's "unknown subcommand",
/// which reads like a bug in Basalt rather than an old git.
const MIN_GIT: (u32, u32) = (2, 23);

/// Local git is filesystem work and should be milliseconds; a fifth of a minute
/// means something is wrong and the panel should say so rather than spin.
pub(crate) const LOCAL_TIMEOUT: Duration = Duration::from_secs(20);

/// Network git is a different budget: a first push of a real config repo over a
/// slow link is legitimately slow, and killing it at 20s would break the feature.
/// It still has a ceiling — an unreachable host must not wedge the panel forever,
/// and a credential window nobody noticed must eventually give up.
pub(crate) const REMOTE_TIMEOUT: Duration = Duration::from_secs(120);

/// Past this we stop keeping bytes. A generated .sql file can produce a diff
/// larger than the window can render, and reading it fully means holding it twice
/// — once here and once across the IPC boundary.
const MAX_OUTPUT: usize = 2 * 1024 * 1024;

const POLL: Duration = Duration::from_millis(5);

pub(crate) struct GitOutput {
    pub stdout: Vec<u8>,
    pub stderr: Vec<u8>,
    code: Option<i32>,
    /// We killed it at the deadline. Not a git failure — a git that never
    /// answered, which is a different thing to tell the user.
    pub timed_out: bool,
    /// Output ran past `MAX_OUTPUT` and the tail was dropped.
    pub truncated: bool,
}

impl GitOutput {
    pub fn success(&self) -> bool {
        self.code == Some(0)
    }
}

enum Availability {
    Ok,
    Missing,
    TooOld(String),
}

/// Checked once. The remedy for both failures is "install a newer git and
/// restart", which is what the error says, so re-probing on every status call
/// would cost a subprocess per poll to learn something that cannot have changed
/// in a way this process can act on.
static AVAILABILITY: OnceLock<Availability> = OnceLock::new();

fn probe() -> Availability {
    let mut cmd = Command::new("git");
    cmd.arg("--version").stdin(Stdio::null());
    hide_console(&mut cmd);

    let Ok(out) = cmd.output() else {
        return Availability::Missing;
    };
    if !out.status.success() {
        return Availability::Missing;
    }

    // "git version 2.51.0.windows.1" — take the first two numeric components and
    // ignore whatever the vendor appended.
    let text = String::from_utf8_lossy(&out.stdout).trim().to_string();
    let version = text.split_whitespace().nth(2).unwrap_or_default();
    let mut parts = version.split('.').filter_map(|p| p.parse::<u32>().ok());
    let found = (parts.next().unwrap_or(0), parts.next().unwrap_or(0));

    if found < MIN_GIT {
        Availability::TooOld(text)
    } else {
        Availability::Ok
    }
}

pub(crate) fn available() -> bool {
    matches!(AVAILABILITY.get_or_init(probe), Availability::Ok)
}

/// The version failure, worded for whichever of the two it is.
pub(crate) fn availability_error() -> AppError {
    match AVAILABILITY.get_or_init(probe) {
        Availability::Ok => AppError::internal("git is available"),
        Availability::Missing => {
            AppError::GitNotInstalled("git is not installed or not on PATH".into())
        }
        Availability::TooOld(found) => AppError::GitNotInstalled(format!(
            "git {}.{} or newer is required — this machine has {found}",
            MIN_GIT.0, MIN_GIT.1
        )),
    }
}

/// On Windows a GUI process has no console, so spawning one that wants a console
/// creates one — a black window flashing on screen for every call. The Git panel
/// polls status, so without this the release build strobes. Invisible in
/// `tauri dev`, which inherits the terminal it was launched from.
#[cfg(windows)]
fn hide_console(cmd: &mut Command) {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    cmd.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(windows))]
fn hide_console(_cmd: &mut Command) {}

/// Environment every git subprocess gets.
///
/// `GIT_TERMINAL_PROMPT=0`: a GUI has no terminal to answer on, so a remote
/// wanting a username would leave git blocked on a read that can never complete.
/// GUI helpers are untouched and still answer — this disables git's own prompt,
/// not the credential helper.
///
/// `GIT_OPTIONAL_LOCKS=0`: status refreshes a cached index and takes
/// `index.lock` to do it. This app polls status, so without this it periodically
/// steals the lock from the user's own git in a terminal on the same directory,
/// which surfaces there as a spurious "another git process seems to be running".
/// The flag tells git to skip work that needs the lock and report anyway.
///
/// `LC_ALL=C`: the stderr classifier reads git's English.
fn configure(cmd: &mut Command) {
    cmd.env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_OPTIONAL_LOCKS", "0")
        .env("LC_ALL", "C")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    hide_console(cmd);
}

/// Read to EOF, keeping at most `cap` bytes.
///
/// Reading continues past the cap rather than returning early: the child writes
/// into a pipe with a small OS buffer, and a reader that stops leaves it blocked
/// on a write forever — which the timeout would then report as a hang.
fn drain<R: Read>(mut source: R, cap: usize) -> (Vec<u8>, bool) {
    let mut kept = Vec::new();
    let mut chunk = [0u8; 16 * 1024];
    let mut truncated = false;

    loop {
        match source.read(&mut chunk) {
            Ok(0) => break,
            Ok(n) => {
                let room = cap.saturating_sub(kept.len());
                kept.extend_from_slice(&chunk[..n.min(room)]);
                truncated |= n > room;
            }
            Err(e) if e.kind() == std::io::ErrorKind::Interrupted => continue,
            Err(_) => break,
        }
    }
    (kept, truncated)
}

/// Run `git -C <dir> <args>` with a deadline.
pub(crate) fn run(dir: &Path, args: &[&str], timeout: Duration) -> AppResult<GitOutput> {
    if !available() {
        return Err(availability_error());
    }

    let mut cmd = Command::new("git");
    cmd.arg("-C").arg(dir).args(args);
    configure(&mut cmd);
    spawn(cmd, timeout)
}

/// Run another program in `dir` under the same discipline — used for `gh`.
pub(crate) fn run_in(program: &str, dir: &Path, args: &[&str], timeout: Duration) -> AppResult<GitOutput> {
    let mut cmd = Command::new(program);
    cmd.args(args).current_dir(dir);
    configure(&mut cmd);
    spawn(cmd, timeout)
}

fn spawn(mut cmd: Command, timeout: Duration) -> AppResult<GitOutput> {
    let mut child = cmd.spawn().map_err(|e| {
        if e.kind() == std::io::ErrorKind::NotFound {
            availability_error()
        } else {
            AppError::internal(e)
        }
    })?;

    // Both pipes are drained on threads of their own so neither can fill and
    // block the child while we are waiting on the other.
    let out_pipe = child.stdout.take();
    let err_pipe = child.stderr.take();
    let out_thread = thread::spawn(move || out_pipe.map(|p| drain(p, MAX_OUTPUT)));
    let err_thread = thread::spawn(move || err_pipe.map(|p| drain(p, 64 * 1024)));

    // Polled rather than waited on: `Child::wait` needs `&mut`, so a thread that
    // waits owns the child and nothing is left able to kill it. Polling keeps the
    // handle here, at the cost of up to `POLL` of latency on a fast call.
    let deadline = Instant::now() + timeout;
    let mut code = None;
    let mut timed_out = false;
    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                code = status.code();
                break;
            }
            Ok(None) => {}
            Err(e) => return Err(AppError::internal(e)),
        }
        if Instant::now() >= deadline {
            let _ = child.kill();
            let _ = child.wait();
            timed_out = true;
            break;
        }
        thread::sleep(POLL);
    }

    let (stdout, out_cut) = out_thread.join().ok().flatten().unwrap_or_default();
    let (stderr, _) = err_thread.join().ok().flatten().unwrap_or_default();

    Ok(GitOutput {
        stdout,
        stderr,
        code,
        timed_out,
        truncated: out_cut,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_the_head_of_oversized_output_and_says_it_was_cut() {
        let source = [b'x'; 100];
        let (kept, truncated) = drain(&source[..], 10);
        assert_eq!(kept.len(), 10);
        assert!(truncated);
    }

    #[test]
    fn keeps_output_under_the_cap_whole() {
        let source = [b'x'; 10];
        let (kept, truncated) = drain(&source[..], 100);
        assert_eq!(kept.len(), 10);
        assert!(!truncated);
    }

    // The real git on this machine has to clear the floor, or every test below
    // this layer is testing a fallback path.
    #[test]
    fn the_installed_git_meets_the_minimum() {
        assert!(available(), "{}", availability_error());
    }

    // The behaviour a hung `git fetch` depends on: something slow, killed at the
    // deadline, reported as timed out rather than as a failure of its own.
    //
    // `ping` rather than `timeout` on Windows: `timeout` refuses a redirected
    // stdin and exits immediately, which every process here has.
    #[test]
    fn a_command_that_outlives_its_deadline_is_killed_and_reported() {
        let dir = std::env::temp_dir();
        let (program, args): (&str, &[&str]) = if cfg!(windows) {
            ("ping", &["-n", "6", "127.0.0.1"])
        } else {
            ("sleep", &["5"])
        };

        let started = Instant::now();
        let out = run_in(program, &dir, args, Duration::from_millis(300))
            .expect("spawn should succeed");

        assert!(out.timed_out, "the deadline should have fired");
        assert!(!out.success(), "a killed process is not a success");
        // And it actually stopped, rather than the flag being set while the child
        // ran on — the whole point is that the panel gets its thread back.
        assert!(started.elapsed() < Duration::from_secs(4), "should not have waited it out");
    }
}
