//! Pure SQL text utilities shared across services — no DB connections, no tauri.
//! Three concerns, each unit-tested against a corpus:
//! - `split`: break a script into statements (single/double/backtick quotes,
//!   `--` and `/* */` comments, Postgres `$$` dollar-quoting)
//! - `classify`: leading-keyword + WHERE analysis for confirm / read-only / tx
//! - `quote`: per-engine identifier quoting
//!
//! Splitting and classification live ONLY here (Rust) — the editor ships raw
//! text, never its own parse. No `DELIMITER` support in v1 (documented).

mod classify;
mod quote;
mod split;

pub use classify::{confirmation_reason, is_read_only, tx_effect, TxEffect};
pub use quote::{quote_ident, quote_qualified};
pub use split::{split, statement_at, Statement};
