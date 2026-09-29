//! Statement classification for the safety rails and tx tracking. Works on the
//! `mask_noise`d text (strings/comments blanked) so a `WHERE` inside a string
//! literal never counts and a leading comment never hides the keyword.

use super::split::mask_noise;
use crate::drivers::types::Engine;

/// The transaction control a statement performs, for the session's tx status.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TxEffect {
    Begin,
    /// COMMIT, ROLLBACK, or a statement that commits implicitly.
    End,
    None,
}

/// A human reason a statement needs confirmation, or `None` if it is safe to run
/// without prompting: `DROP`/`TRUNCATE`/`ALTER`, or a `DELETE`/`UPDATE` with no
/// `WHERE` (affects every row).
pub fn confirmation_reason(text: &str) -> Option<String> {
    let masked = mask_noise(text);
    match first_word(&masked)?.as_str() {
        "DROP" => Some("DROP permanently removes a database object.".into()),
        "TRUNCATE" => Some("TRUNCATE empties the table.".into()),
        "ALTER" => Some("ALTER changes a database object.".into()),
        "DELETE" if !has_word(&masked, "WHERE") => {
            Some("DELETE without WHERE removes every row.".into())
        }
        "UPDATE" if !has_word(&masked, "WHERE") => {
            Some("UPDATE without WHERE changes every row.".into())
        }
        _ => None,
    }
}

/// Whether a statement only reads (first line of read-only enforcement; the
/// engine-level read-only session is the authoritative second layer).
pub fn is_read_only(text: &str) -> bool {
    matches!(
        first_word(&mask_noise(text)).as_deref(),
        Some(
            "SELECT"
                | "WITH"
                | "EXPLAIN"
                | "SHOW"
                | "DESCRIBE"
                | "DESC"
                | "TABLE"
                | "VALUES"
                | "PRAGMA"
        )
    )
}

/// Whether a statement produces a result set (so it should be `fetch`ed rather
/// than `execute`d): the read verbs, or any statement with a `RETURNING` clause.
pub fn returns_rows(text: &str) -> bool {
    let masked = mask_noise(text);
    matches!(
        first_word(&masked).as_deref(),
        Some(
            "SELECT"
                | "WITH"
                | "SHOW"
                | "EXPLAIN"
                | "VALUES"
                | "TABLE"
                | "DESCRIBE"
                | "DESC"
                | "PRAGMA"
        )
    ) || has_word(&masked, "RETURNING")
}

// ponytail: keyword classification, so a tx opened inside a function body or by
// `SET autocommit = 0` goes unseen; read the protocol status if sqlx exposes it.
pub fn tx_effect(text: &str, engine: Engine) -> TxEffect {
    let masked = mask_noise(text);
    let mut words = masked.split_whitespace();
    match words.next().map(str::to_ascii_uppercase).as_deref() {
        Some("BEGIN") => TxEffect::Begin,
        // `START TRANSACTION` (MySQL/pg); a bare `START` is not tx control.
        Some("START")
            if words.next().map(str::to_ascii_uppercase).as_deref() == Some("TRANSACTION") =>
        {
            TxEffect::Begin
        }
        // `ROLLBACK TO [SAVEPOINT] x` undoes to a savepoint and keeps the tx open.
        Some("ROLLBACK") if has_word(&masked, "TO") => TxEffect::None,
        // pg/SQLite treat `END` as commit; MySQL only uses it to close blocks,
        // which are dollar/BEGIN…END bodies that never arrive here standalone.
        Some("COMMIT" | "END" | "ROLLBACK") => TxEffect::End,
        // MySQL commits an open tx before any DDL (dev.mysql.com, "Statements That
        // Cause an Implicit Commit"); temporary tables are the exception.
        Some("CREATE" | "ALTER" | "DROP" | "TRUNCATE" | "RENAME")
            if engine == Engine::MySql && !has_word(&masked, "TEMPORARY") =>
        {
            TxEffect::End
        }
        _ => TxEffect::None,
    }
}

/// The leading keyword, uppercased, or `None` for whitespace-only input.
fn first_word(masked: &str) -> Option<String> {
    let word: String = masked
        .trim_start()
        .chars()
        .take_while(|c| c.is_ascii_alphabetic())
        .collect();
    (!word.is_empty()).then(|| word.to_ascii_uppercase())
}

/// Word-bounded, case-insensitive search over the masked text.
fn has_word(masked: &str, needle: &str) -> bool {
    masked
        .split(|c: char| !c.is_ascii_alphanumeric() && c != '_')
        .any(|tok| tok.eq_ignore_ascii_case(needle))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn destructive_statements_need_confirmation() {
        assert!(confirmation_reason("DROP TABLE users").is_some());
        assert!(confirmation_reason("truncate table t").is_some());
        assert!(confirmation_reason("ALTER TABLE t ADD c int").is_some());
        assert!(confirmation_reason("DELETE FROM t").is_some());
        assert!(confirmation_reason("UPDATE t SET a = 1").is_some());
    }

    #[test]
    fn scoped_writes_and_reads_do_not() {
        assert!(confirmation_reason("DELETE FROM t WHERE id = 1").is_none());
        assert!(confirmation_reason("UPDATE t SET a = 1 WHERE id = 2").is_none());
        assert!(confirmation_reason("SELECT * FROM t").is_none());
        assert!(confirmation_reason("INSERT INTO t VALUES (1)").is_none());
    }

    #[test]
    fn where_inside_a_string_or_comment_still_counts_as_missing() {
        // The only "where" is inside a literal / comment → treated as no WHERE.
        assert!(confirmation_reason("DELETE FROM t -- delete where needed").is_some());
        assert!(confirmation_reason("UPDATE t SET note = 'where' ").is_some());
        // A leading comment must not hide the keyword.
        assert!(confirmation_reason("/* danger */ DROP TABLE t").is_some());
    }

    #[test]
    fn read_only_classification() {
        assert!(is_read_only("  select 1"));
        assert!(is_read_only("WITH x AS (SELECT 1) SELECT * FROM x"));
        assert!(is_read_only("EXPLAIN SELECT 1"));
        assert!(!is_read_only("INSERT INTO t VALUES (1)"));
        assert!(!is_read_only("update t set a=1"));
    }

    #[test]
    fn tx_effect_detection() {
        let pg = Engine::Postgres;
        assert_eq!(tx_effect("BEGIN", pg), TxEffect::Begin);
        assert_eq!(tx_effect("start transaction", pg), TxEffect::Begin);
        assert_eq!(tx_effect("COMMIT", pg), TxEffect::End);
        assert_eq!(tx_effect("rollback", pg), TxEffect::End);
        assert_eq!(tx_effect("SELECT 1", pg), TxEffect::None);
        assert_eq!(tx_effect("START", pg), TxEffect::None);
    }

    #[test]
    fn rollback_to_a_savepoint_keeps_the_tx_open() {
        assert_eq!(
            tx_effect("ROLLBACK TO SAVEPOINT a", Engine::Postgres),
            TxEffect::None
        );
        assert_eq!(tx_effect("rollback to a", Engine::MySql), TxEffect::None);
        assert_eq!(
            tx_effect("ROLLBACK TRANSACTION TO a", Engine::Sqlite),
            TxEffect::None
        );
    }

    #[test]
    fn mysql_ddl_commits_implicitly_but_not_elsewhere() {
        assert_eq!(
            tx_effect("CREATE TABLE t (a int)", Engine::MySql),
            TxEffect::End
        );
        assert_eq!(tx_effect("DROP TABLE t", Engine::MySql), TxEffect::End);
        assert_eq!(
            tx_effect("CREATE TEMPORARY TABLE t (a int)", Engine::MySql),
            TxEffect::None
        );
        assert_eq!(
            tx_effect("CREATE TABLE t (a int)", Engine::Postgres),
            TxEffect::None
        );
    }
}
