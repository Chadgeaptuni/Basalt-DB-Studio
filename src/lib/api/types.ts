// TS mirror of the Rust wire types (src-tauri/src/drivers/types.rs) and the
// error envelope (src-tauri/src/errors/mod.rs). Kept in lockstep by hand — a new
// backend variant is a new member here, never a stringly-typed fallback.

/** Every user-facing failure mode. Matches AppError's serde tag exactly. */
export type ErrorKind =
  | "connectionRefused"
  | "authFailed"
  | "tlsError"
  | "tunnelError"
  | "queryError"
  | "queryCancelled"
  | "readOnlyViolation"
  | "noPrimaryKey"
  | "ambiguousRowIdentity"
  | "confirmationRequired"
  | "secretNotFound"
  | "keychainUnavailable"
  | "vaultLocked"
  | "configIo"
  | "configParse"
  | "gitNotInstalled"
  | "gitConflict"
  | "gitDirty"
  | "importParse"
  | "internal";

/** Serialized shape of every command error (ErrorResponse in Rust). */
export interface ErrorResponse {
  kind: ErrorKind;
  message: string;
  /** Kind-specific structured payload (error position, classified stmts, line…). */
  detail?: unknown;
}

// ── Connections (M1) ────────────────────────────────────────────────────────
// Mirrors src-tauri/src/config/connections.rs and drivers. The profile carries
// NO password field by construction — only a `secretRef` into the SecretStore.

export type Engine = "postgres" | "mysql" | "sqlite";

/** Postgres-style TLS ladder, applied per engine. */
export type SslMode = "disable" | "require" | "verify-ca" | "verify-full";

export interface TlsConfig {
  mode: SslMode;
  /** File-path references (not secrets). */
  caCertPath?: string;
  clientCertPath?: string;
  clientKeyPath?: string;
}

export type SshAuthKind = "password" | "key" | "agent";

export interface SshConfig {
  host: string;
  port: number;
  user: string;
  authKind: SshAuthKind;
  /** Path to the private key (auth = key). Passphrase lives in the SecretStore. */
  keyPath?: string;
}

/** A saved connection. Git-syncable; contains no secret material. */
export interface ConnectionProfile {
  id: string;
  name: string;
  engine: Engine;
  // Network engines (postgres, mysql):
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  // File engine (sqlite):
  filePath?: string;
  readOnly: boolean;
  /** Bounds the initial connect (default ~10s), separate from statement timeout. */
  connectTimeoutSecs?: number;
  tls?: TlsConfig;
  ssh?: SshConfig;
  /** UUID into the SecretStore; the password/passphrase never live here. */
  secretRef?: string;
}

/** A live connected tab returned by `connect`. */
export interface SessionInfo {
  sessionId: string;
  profileId: string;
  engine: Engine;
  readOnly: boolean;
}

// ── Schema introspection (M1) ───────────────────────────────────────────────
// `introspect` returns namespaces + their tables/views (light). Columns and
// indexes are fetched lazily per table via `describe_table`.

export type RelationKind = "table" | "view";

export interface RelationNode {
  name: string;
  kind: RelationKind;
}

/** pg schema · mysql database · sqlite "main". */
export interface Namespace {
  name: string;
  relations: RelationNode[];
}

export interface SchemaTree {
  namespaces: Namespace[];
}

export interface ColumnInfo {
  name: string;
  typeName: string;
  nullable: boolean;
  isPk: boolean;
}

export interface IndexInfo {
  name: string;
  columns: string[];
  unique: boolean;
}

export interface TableDescription {
  columns: ColumnInfo[];
  indexes: IndexInfo[];
}

// ── Query execution (M2) ─────────────────────────────────────────────────────
// Mirrors the CellValue enum + result types in drivers/types.rs. CellValue is
// adjacently tagged — switch on `kind`. `int`/`float` are JS numbers (bigint past
// 2^53 loses display precision — tracked); `decimal` stays a string.

export interface BytesPreview {
  len: number;
  /** Lowercase hex of the first 64 bytes. */
  preview: string;
}

export interface UnknownValue {
  typeName: string;
  display: string;
}

export type CellValue =
  | { kind: "null" }
  | { kind: "bool"; value: boolean }
  | { kind: "int"; value: number }
  | { kind: "float"; value: number }
  | { kind: "text"; value: string }
  | { kind: "decimal"; value: string }
  | { kind: "date"; value: string }
  | { kind: "time"; value: string }
  | { kind: "dateTime"; value: string }
  | { kind: "json"; value: unknown }
  | { kind: "bytes"; value: BytesPreview }
  | { kind: "array"; value: CellValue[] }
  | { kind: "unknown"; value: UnknownValue };

/** One statement's outcome; `columns`/`rows` are empty for non-SELECT. */
export interface StatementResult {
  columns: ColumnInfo[];
  rows: CellValue[][];
  rowsAffected: number;
  truncated: boolean;
  durationMs: number;
}

export type TxStatus = "idle" | "inTx" | "error";

/** The `run_query` response: one result per statement, plus resulting tx state. */
export interface RunResult {
  statements: StatementResult[];
  txStatus: TxStatus;
}
