//! Wire types shared with the frontend. Every struct here is mirrored, field for
//! field, in `src/lib/api/types.ts` — a new backend field is a new member there,
//! never a stringly-typed fallback. Serialization is camelCase with `None`
//! options omitted so the TypeScript `?:` optionals line up exactly.
//!
//! `ConnectionProfile` deliberately lives in `config/connections.rs` (it is the
//! git-sync unit), but it reuses `Engine`, `TlsConfig`, and `SshConfig` from
//! here so the connection form and the driver speak one vocabulary.

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Supported database engines. All three are wired end to end (connect →
/// introspect → describe_table); `values.rs` cell decode joins them in M2.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Engine {
    Postgres,
    MySql,
    Sqlite,
}

/// Postgres-style TLS ladder, applied per engine.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum SslMode {
    Disable,
    Require,
    VerifyCa,
    VerifyFull,
}

/// Certificate/key *paths* (not secrets) plus the chosen ladder rung.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TlsConfig {
    pub mode: SslMode,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ca_cert_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client_cert_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client_key_path: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum SshAuthKind {
    Password,
    Key,
    Agent,
}

/// SSH tunnel target. The key passphrase / SSH password live in the SecretStore;
/// only the key file *path* is stored here.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SshConfig {
    pub host: String,
    pub port: u16,
    pub user: String,
    pub auth_kind: SshAuthKind,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub key_path: Option<String>,
}

/// A live connected tab, returned by `connect` and echoed by the session store.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SessionInfo {
    pub session_id: String,
    pub profile_id: String,
    pub engine: Engine,
    pub read_only: bool,
    /// The database this session is actually pointed at, which is the profile's
    /// only until a Postgres database node opens a second session on the same
    /// profile. Carried so the tree can label the row it belongs to without
    /// re-deriving it from the profile it no longer matches.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub database: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum RelationKind {
    Table,
    View,
}

/// A single table or view inside a namespace (light — no columns yet).
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RelationNode {
    pub name: String,
    pub kind: RelationKind,
}

/// A pg schema · mysql database · sqlite "main".
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Namespace {
    pub name: String,
    pub relations: Vec<RelationNode>,
}

/// The lightweight tree returned by `introspect`; columns/indexes are fetched
/// lazily per table via `describe_table`.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SchemaTree {
    pub namespaces: Vec<Namespace>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ColumnInfo {
    pub name: String,
    pub type_name: String,
    pub nullable: bool,
    pub is_pk: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct IndexInfo {
    pub name: String,
    pub columns: Vec<String>,
    pub unique: bool,
}

/// The per-table detail behind `describe_table`.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TableDescription {
    pub columns: Vec<ColumnInfo>,
    pub indexes: Vec<IndexInfo>,
}

// ── Query execution (M2) ─────────────────────────────────────────────────────

/// A single decoded cell. Adjacently serde-tagged (`{ "kind", "value" }`) so the
/// grid switches on `kind` without guessing. Decode lives in each engine's
/// `values.rs` — the single edge-type site. `Int(i64)` stays exact on the Rust
/// side (JS loses precision past 2^53 — a display caveat, tracked); NUMERIC /
/// DECIMAL / u64 are `Decimal(String)`, never f64. Unmatched engine types fall
/// back to a text cast, else `Unknown`.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(tag = "kind", content = "value", rename_all = "camelCase")]
pub enum CellValue {
    Null,
    Bool(bool),
    Int(i64),
    Float(f64),
    Text(String),
    Decimal(String),
    /// ISO 8601, exactly as the engine returns it (offset preserved, naive stays
    /// naive). The datetime-display setting transforms rendering only.
    Date(String),
    Time(String),
    DateTime(String),
    Json(Value),
    Bytes(BytesPreview),
    /// Postgres arrays, recursive.
    Array(Vec<CellValue>),
    Unknown(UnknownValue),
}

/// A blob shown by length + a hex head; full bytes are not shipped in v1.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BytesPreview {
    pub len: usize,
    /// Lowercase hex of the first 64 bytes.
    pub preview: String,
}

impl BytesPreview {
    /// Length + lowercase hex of the first 64 bytes. The single blob-preview site,
    /// shared by every engine's `values.rs`.
    pub fn from_bytes(bytes: &[u8]) -> Self {
        use std::fmt::Write;
        let head = &bytes[..bytes.len().min(64)];
        let mut preview = String::with_capacity(head.len() * 2);
        for b in head {
            let _ = write!(preview, "{b:02x}");
        }
        BytesPreview {
            len: bytes.len(),
            preview,
        }
    }
}

/// Geometry, ranges, custom types: their text representation plus the SQL type.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UnknownValue {
    pub type_name: String,
    pub display: String,
}

/// A failing statement's error, carried on its own result so a multi-statement
/// run renders the error on that statement's tab (mirrors the command error
/// envelope; `kind` is `queryError` for runtime failures).
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StatementError {
    pub kind: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<Value>,
}

/// One statement's outcome. `columns`/`rows` are empty for non-SELECT; `rows`
/// holds up to the row limit, with `truncated` set when a further row existed.
/// `ColumnInfo` is reused as the column metadata (for arbitrary results `is_pk`
/// is false and `nullable` is best-effort). `error` is set on the statement that
/// failed; execution stops there.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StatementResult {
    pub columns: Vec<ColumnInfo>,
    pub rows: Vec<Vec<CellValue>>,
    pub rows_affected: u64,
    pub truncated: bool,
    pub duration_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<StatementError>,
}

/// Session transaction state for the status bar. Pg reads it from connection
/// status; MySQL/SQLite infer it from statement classification.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum TxStatus {
    Idle,
    InTx,
    Error,
}

/// The `run_query` response: one result per statement, plus the resulting tx
/// state. Execution stops at the first failing statement (surfaced as its error).
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RunResult {
    pub statements: Vec<StatementResult>,
    pub tx_status: TxStatus,
}

// ── Grid CRUD (M3) ────────────────────────────────────────────────────────────

/// The buffered table-data view backing the editable grid. `columns` come from
/// `describe_table` (authoritative `isPk`/`nullable`/`typeName`), in the same
/// order as each row's cells. `key_columns` is the row-identity used for
/// UPDATE/DELETE — the primary key, or (fallback) every non-binary column.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BrowseResult {
    pub columns: Vec<ColumnInfo>,
    pub rows: Vec<Vec<CellValue>>,
    pub truncated: bool,
    pub key_columns: Vec<String>,
    /// True when `key_columns` is the all-non-binary-columns fallback (no PK).
    pub key_is_fallback: bool,
    /// False when no usable identity exists (e.g. a view / all-binary table).
    pub editable: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub not_editable_reason: Option<String>,
    /// The exact statement that produced `rows` — shown (and re-runnable) in the
    /// table tab's editor, so the UI never displays SQL that didn't run.
    pub sql: String,
    pub duration_ms: u64,
}

/// One column's new value in an insert or update.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CellChange {
    pub column: String,
    pub value: CellValue,
}

/// A single staged edit. `key` is parallel to the commit's `key_columns` and
/// holds the row's *original* identity values (so editing a PK cell still targets
/// the right row).
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(tag = "op", rename_all = "camelCase")]
pub enum GridEdit {
    Update {
        key: Vec<CellValue>,
        set: Vec<CellChange>,
    },
    Insert {
        set: Vec<CellChange>,
    },
    Delete {
        key: Vec<CellValue>,
    },
}

impl GridEdit {
    /// Columns this edit writes (for existence validation against the table).
    pub fn columns(&self) -> &[CellChange] {
        match self {
            GridEdit::Update { set, .. } | GridEdit::Insert { set } => set,
            GridEdit::Delete { .. } => &[],
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GridCommitResult {
    pub rows_affected: u64,
}

// ── DDL (M4) ──────────────────────────────────────────────────────────────────
// A structured change turned into engine-specific SQL by `sqlgen::ddl`, previewed
// in a modal, then executed via the normal run path (which owns the safety gates).

/// A column in a CREATE TABLE / ADD COLUMN. `type_name` and `default` are raw SQL
/// the user authors (dialect-appropriate) and reviews in the preview.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ColumnSpec {
    pub name: String,
    pub type_name: String,
    pub nullable: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default: Option<String>,
}

/// A structured DDL operation. One `kind` per supported change; the frontend
/// builds it from the table designer / index editor / tree actions.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum DdlRequest {
    CreateTable {
        namespace: String,
        name: String,
        columns: Vec<ColumnSpec>,
        primary_key: Vec<String>,
    },
    DropTable {
        namespace: String,
        name: String,
    },
    RenameTable {
        namespace: String,
        name: String,
        new_name: String,
    },
    AddColumn {
        namespace: String,
        table: String,
        column: ColumnSpec,
    },
    DropColumn {
        namespace: String,
        table: String,
        column: String,
    },
    RenameColumn {
        namespace: String,
        table: String,
        from: String,
        to: String,
    },
    CreateIndex {
        namespace: String,
        table: String,
        name: String,
        columns: Vec<String>,
        unique: bool,
    },
    DropIndex {
        namespace: String,
        table: String,
        name: String,
    },
}

// ── Import / export (M5) ──────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ExportFormat {
    Csv,
    Json,
}

/// Streamed to the frontend over an `ipc::Channel` as an export runs.
#[derive(Serialize, Clone, Copy, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ExportProgress {
    pub rows: u64,
    pub done: bool,
}

/// CSV-import conflict handling, emitted as each engine's native form.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ConflictMode {
    Insert,
    Upsert,
    Skip,
}

#[derive(Serialize, Clone, Copy, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub inserted: u64,
}
