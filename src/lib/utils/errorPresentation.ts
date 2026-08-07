// The one place a backend failure becomes user-facing words (DESIGN §8).
//
// Before U6 this lived in three places — a connect-only title map, a second map
// inside ResultsPane, and an inline conditional in the git panel — so the same
// `kind` read differently depending on which pane caught it, and eight of the
// twenty kinds had no copy at all and fell through to a bare "Error".
//
// The map is a full `Record`, not a `Partial`: a new variant in
// `errors/mod.rs` adds a member to `ERROR_KINDS`, which fails to compile here
// until someone writes what the user should read and do. That is the mechanism
// that keeps "every kind has a specific rendering" true after the audit.

import type { ErrorKind } from "$lib/api/types";

export interface ErrorPresentation {
  /** Kind-specific headline. Never "Something went wrong". */
  title: string;
  /** The next step the user can actually take — an instruction, not a restatement. */
  hint: string;
}

const PRESENTATION: Record<ErrorKind, ErrorPresentation> = {
  connectionRefused: {
    title: "Can't reach the server",
    hint: "Check the host and port, and that the database is running and accepting connections.",
  },
  authFailed: {
    title: "Authentication failed",
    hint: "Check the username and password on this connection.",
  },
  tlsError: {
    title: "TLS handshake failed",
    hint: "Check the SSL mode and the CA / client certificate paths.",
  },
  tunnelError: {
    title: "SSH tunnel failed",
    hint: "Check the tunnel host, user and key path, and that the key is unlocked.",
  },
  queryError: {
    title: "The engine rejected this statement",
    hint: "Fix the statement and run it again — the engine's own message is below.",
  },
  queryCancelled: {
    title: "Query cancelled",
    hint: "Nothing was returned. Run it again when you're ready.",
  },
  readOnlyViolation: {
    title: "This connection is read-only",
    hint: "Turn off read-only in the connection settings to write to this database.",
  },
  noPrimaryKey: {
    title: "No primary key",
    hint: "Rows here can't be identified, so they can't be edited in the grid. Add a primary key, or write the UPDATE by hand.",
  },
  ambiguousRowIdentity: {
    title: "Edit matched more than one row",
    hint: "The whole batch was rolled back, so nothing changed. Add a primary key or a unique index to edit these rows safely.",
  },
  // Never rendered: the frontend catches this kind, runs confirm() and re-invokes
  // with `confirmed: true` (DESIGN §8). Copy exists so the record stays total —
  // if it ever does reach a pane, it should read as the bug it is.
  confirmationRequired: {
    title: "Waiting for confirmation",
    hint: "This statement needs confirming before it runs. If you're seeing this, the confirm step was skipped — please report it.",
  },
  secretNotFound: {
    title: "No stored password",
    hint: "Edit the connection and enter the password again to store it.",
  },
  keychainUnavailable: {
    title: "OS keychain unavailable",
    hint: "Unlock your login keychain, or switch the secret store to the encrypted file backend in Settings.",
  },
  vaultLocked: {
    title: "Secret vault is locked",
    hint: "Unlock the encrypted secret file to use this connection.",
  },
  configIo: {
    title: "Can't read the config directory",
    hint: "Check that the config directory exists and that Basalt can write to it.",
  },
  configParse: {
    title: "Config file is malformed",
    hint: "Fix the TOML by hand, or move the file aside to start from a clean config.",
  },
  gitNotInstalled: {
    title: "Git isn't installed",
    hint: "Install git and restart Basalt — profiles and saved queries sync through the system git.",
  },
  gitConflict: {
    title: "Git conflict",
    hint: "Resolve the conflicts in your git tool, then sync again.",
  },
  gitDirty: {
    title: "A rebase or merge is half-finished",
    hint: "Finish or abort it in your git tool — running more git on top of one is how a repo gets stuck.",
  },
  gitAuthFailed: {
    title: "Git couldn't authenticate with the remote",
    hint: "Basalt doesn't hold git credentials — your system does. Sign in with Git Credential Manager or gh, or check that your SSH key is loaded, then try again.",
  },
  gitPushRejected: {
    title: "The remote has commits this copy doesn't",
    hint: "Pull first — that rebases your work on top of theirs — then push again.",
  },
  gitNoRemote: {
    title: "No remote configured",
    hint: "Add one in the Git panel to share profiles and saved queries with a team. Everything still works locally without it.",
  },
  importParse: {
    title: "Can't parse the CSV",
    hint: "Fix the line named below, or change the header and delimiter settings and try again.",
  },
  internal: {
    title: "Unexpected error",
    hint: "This one is a bug in Basalt. Copy the details and include them in a report.",
  },
};

export function presentError(kind: ErrorKind): ErrorPresentation {
  return PRESENTATION[kind];
}
