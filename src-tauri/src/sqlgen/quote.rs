//! Per-engine identifier quoting. The single place identifiers become SQL text,
//! so grid/DDL generation never hand-rolls quoting. Postgres and SQLite use
//! double quotes (doubling an embedded `"`); MySQL uses backticks (doubling an
//! embedded `` ` ``).

use crate::drivers::types::Engine;

/// Quotes a single identifier for `engine`, escaping the embedded quote char.
pub fn quote_ident(engine: Engine, ident: &str) -> String {
    match engine {
        Engine::MySql => format!("`{}`", ident.replace('`', "``")),
        Engine::Postgres | Engine::Sqlite => format!("\"{}\"", ident.replace('"', "\"\"")),
    }
}

/// Quotes a `namespace.name` pair (schema-qualified table, etc.).
pub fn quote_qualified(engine: Engine, namespace: &str, name: &str) -> String {
    format!(
        "{}.{}",
        quote_ident(engine, namespace),
        quote_ident(engine, name)
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn quotes_per_engine() {
        assert_eq!(quote_ident(Engine::Postgres, "users"), "\"users\"");
        assert_eq!(quote_ident(Engine::Sqlite, "users"), "\"users\"");
        assert_eq!(quote_ident(Engine::MySql, "users"), "`users`");
    }

    #[test]
    fn escapes_embedded_quote_chars() {
        // A double quote in a pg identifier is doubled; a stray backtick is inert.
        assert_eq!(quote_ident(Engine::Postgres, "we\"ird"), "\"we\"\"ird\"");
        // A backtick in a MySQL identifier is doubled.
        assert_eq!(quote_ident(Engine::MySql, "we`ird"), "`we``ird`");
    }

    #[test]
    fn qualifies_with_both_parts_quoted() {
        assert_eq!(
            quote_qualified(Engine::Postgres, "public", "t"),
            "\"public\".\"t\""
        );
        assert_eq!(quote_qualified(Engine::MySql, "db", "t"), "`db`.`t`");
    }
}
