//! Wire types shared with the frontend. Every struct here is mirrored, field for
//! field, in `src/lib/api/types.ts` — a new backend field is a new member there,
//! never a stringly-typed fallback. Serialization is camelCase with `None`
//! options omitted so the TypeScript `?:` optionals line up exactly.
//!
//! `ConnectionProfile` deliberately lives in `config/connections.rs` (it is the
//! git-sync unit), but it reuses `Engine`, `TlsConfig`, and `SshConfig` from
//! here so the connection form and the driver speak one vocabulary.

use serde::{Deserialize, Serialize};

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
