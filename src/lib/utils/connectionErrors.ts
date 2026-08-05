import type { ErrorKind } from "$lib/api/types";

// Kind-specific, actionable headings for connect failures (DESIGN §8) — the
// backend message is rendered below the heading by the caller. Declared once so
// every surface that can fail a connect (start panel, top-bar switcher) says the
// same thing. secretNotFound/keychainUnavailable/vaultLocked land here once the
// secrets slice can produce them.
const CONNECT_TITLE: Partial<Record<ErrorKind, string>> = {
  connectionRefused: "Can't reach the server",
  authFailed: "Authentication failed — check user/password",
  tlsError: "TLS error — check SSL mode and certificates",
  tunnelError: "SSH tunnel failed — check the tunnel settings",
  secretNotFound: "No stored password — edit the connection to add one",
  keychainUnavailable: "OS keychain unavailable",
  vaultLocked: "Vault is locked",
  configParse: "Connection file is malformed",
};

export function connectErrorTitle(kind: ErrorKind): string {
  return CONNECT_TITLE[kind] ?? "Connection error";
}
