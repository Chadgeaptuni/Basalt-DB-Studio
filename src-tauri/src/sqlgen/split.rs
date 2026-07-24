//! Multi-statement splitting. A byte-level state machine finds top-level `;`
//! while ignoring semicolons inside string/identifier literals, `--` line and
//! `/* */` block comments, and Postgres `$tag$` dollar-quoted bodies. All
//! delimiter chars are ASCII, and multi-byte UTF-8 bytes are all ≥ 0x80, so
//! byte scanning never splits a codepoint and every cut lands on a char boundary.

/// One statement in a script. `start..end` tiles the whole input (each statement
/// absorbs the whitespace/comments before it), so `statement_at` maps any cursor
/// offset to exactly one statement. `text` is trimmed and carries no trailing `;`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Statement {
    pub start: usize,
    pub end: usize,
    pub text: String,
}

/// Splits a script into its non-empty statements.
pub fn split(sql: &str) -> Vec<Statement> {
    let mut out = Vec::new();
    let mut seg_start = 0usize;
    let mut prev_end = 0usize;
    for cut in top_level_semicolons(sql) {
        push_segment(sql, seg_start, cut + 1, &mut prev_end, &mut out);
        seg_start = cut + 1;
    }
    push_segment(sql, seg_start, sql.len(), &mut prev_end, &mut out);
    out
}

/// The statement containing byte `offset` (run-at-cursor). Offsets past the last
/// statement (trailing whitespace/comments) resolve to the last statement.
pub fn statement_at(sql: &str, offset: usize) -> Option<Statement> {
    let stmts = split(sql);
    for s in &stmts {
        if offset < s.end {
            return Some(s.clone());
        }
    }
    stmts.into_iter().last()
}

/// Returns `sql` with every string/identifier literal and comment blanked to
/// spaces (newlines kept), so `classify` can scan for keywords without matching
/// inside a string or comment. Boundaries are ASCII, so the result stays valid
/// UTF-8. Shared with `classify` to keep one scanner.
pub(super) fn mask_noise(sql: &str) -> String {
    let b = sql.as_bytes();
    let n = b.len();
    let mut out = b.to_vec();
    let mut i = 0;
    while i < n {
        let (from, next) = match b[i] {
            b'\'' => (i, skip_quoted(b, i, b'\'', true)),
            b'"' => (i, skip_quoted(b, i, b'"', false)),
            b'`' => (i, skip_quoted(b, i, b'`', false)),
            b'-' if i + 1 < n && b[i + 1] == b'-' => (i, skip_line_comment(b, i)),
            b'/' if i + 1 < n && b[i + 1] == b'*' => (i, skip_block_comment(b, i)),
            b'$' => match skip_dollar(b, i) {
                Some(next) => (i, next),
                None => {
                    i += 1;
                    continue;
                }
            },
            _ => {
                i += 1;
                continue;
            }
        };
        for byte in out.iter_mut().take(next.min(n)).skip(from) {
            if *byte != b'\n' {
                *byte = b' ';
            }
        }
        i = next;
    }
    String::from_utf8(out).unwrap_or_else(|_| sql.to_string())
}

fn push_segment(
    sql: &str,
    raw_start: usize,
    raw_end: usize,
    prev_end: &mut usize,
    out: &mut Vec<Statement>,
) {
    let trimmed = sql[raw_start..raw_end].trim();
    let text = trimmed.strip_suffix(';').unwrap_or(trimmed).trim_end();
    if text.is_empty() {
        return;
    }
    out.push(Statement {
        start: *prev_end,
        end: raw_end,
        text: text.to_string(),
    });
    *prev_end = raw_end;
}

fn top_level_semicolons(sql: &str) -> Vec<usize> {
    let b = sql.as_bytes();
    let n = b.len();
    let mut cuts = Vec::new();
    let mut i = 0;
    while i < n {
        match b[i] {
            // Single quotes honor backslash escapes (MySQL default) and doubling.
            b'\'' => i = skip_quoted(b, i, b'\'', true),
            // Identifier/ANSI-string quotes use doubling only.
            b'"' => i = skip_quoted(b, i, b'"', false),
            b'`' => i = skip_quoted(b, i, b'`', false),
            b'-' if i + 1 < n && b[i + 1] == b'-' => i = skip_line_comment(b, i),
            b'/' if i + 1 < n && b[i + 1] == b'*' => i = skip_block_comment(b, i),
            b'$' => match skip_dollar(b, i) {
                Some(next) => i = next,
                None => i += 1,
            },
            b';' => {
                cuts.push(i);
                i += 1;
            }
            _ => i += 1,
        }
    }
    cuts
}

/// `start` indexes the opening quote; returns the index just past the closer.
/// An unterminated literal consumes to end (a partial script never mis-splits).
fn skip_quoted(b: &[u8], start: usize, q: u8, backslash: bool) -> usize {
    let n = b.len();
    let mut i = start + 1;
    while i < n {
        let c = b[i];
        if backslash && c == b'\\' && i + 1 < n {
            i += 2;
            continue;
        }
        if c == q {
            if i + 1 < n && b[i + 1] == q {
                i += 2; // doubled quote → escaped, stay inside
                continue;
            }
            return i + 1;
        }
        i += 1;
    }
    n
}

fn skip_line_comment(b: &[u8], start: usize) -> usize {
    let n = b.len();
    let mut i = start + 2;
    while i < n && b[i] != b'\n' {
        i += 1;
    }
    i
}

fn skip_block_comment(b: &[u8], start: usize) -> usize {
    let n = b.len();
    let mut i = start + 2;
    while i + 1 < n {
        if b[i] == b'*' && b[i + 1] == b'/' {
            return i + 2;
        }
        i += 1;
    }
    n
}

/// At a `$`, returns the index past a `$tag$…$tag$` body, or `None` if this `$`
/// does not open a dollar-quote (e.g. a `$1` positional parameter). The tag obeys
/// identifier rules (empty, or alpha/`_` then alnum/`_`) so `$1$` is not a tag.
fn skip_dollar(b: &[u8], start: usize) -> Option<usize> {
    let n = b.len();
    let mut j = start + 1;
    if j < n && (b[j].is_ascii_alphabetic() || b[j] == b'_') {
        j += 1;
        while j < n && (b[j].is_ascii_alphanumeric() || b[j] == b'_') {
            j += 1;
        }
    }
    if j >= n || b[j] != b'$' {
        return None;
    }
    let delim = &b[start..=j]; // e.g. b"$$" or b"$body$"
    let mut i = j + 1;
    while i + delim.len() <= n {
        if &b[i..i + delim.len()] == delim {
            return Some(i + delim.len());
        }
        i += 1;
    }
    Some(n)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn texts(sql: &str) -> Vec<String> {
        split(sql).into_iter().map(|s| s.text).collect()
    }

    #[test]
    fn splits_plain_statements_and_trims() {
        assert_eq!(texts("SELECT 1; SELECT 2;"), ["SELECT 1", "SELECT 2"]);
        // Trailing statement without a semicolon is kept.
        assert_eq!(texts("  SELECT 1 ;\n SELECT 2 "), ["SELECT 1", "SELECT 2"]);
        // Empty segments (blank / bare `;`) are dropped.
        assert_eq!(texts(";;\nSELECT 1;;"), ["SELECT 1"]);
        assert!(texts("   \n  ").is_empty());
    }

    #[test]
    fn semicolons_inside_literals_do_not_split() {
        assert_eq!(texts("SELECT ';'"), ["SELECT ';'"]);
        assert_eq!(texts("SELECT 'a;b', \"c;d\""), ["SELECT 'a;b', \"c;d\""]);
        assert_eq!(texts("SELECT `x;y` FROM t"), ["SELECT `x;y` FROM t"]);
        // Doubled and backslash-escaped quotes stay inside the string.
        assert_eq!(texts("SELECT 'it''s; ok'"), ["SELECT 'it''s; ok'"]);
        assert_eq!(texts(r"SELECT 'a\'; b'"), [r"SELECT 'a\'; b'"]);
    }

    #[test]
    fn semicolons_inside_comments_do_not_split() {
        // The `;` inside the line comment must not split (comment stays in text).
        assert_eq!(
            texts("SELECT 1 -- a; b\n; SELECT 2"),
            ["SELECT 1 -- a; b", "SELECT 2"]
        );
        assert_eq!(
            texts("SELECT /* a; b */ 1; SELECT 2"),
            ["SELECT /* a; b */ 1", "SELECT 2"]
        );
    }

    #[test]
    fn dollar_quoted_body_is_one_statement() {
        let sql = "CREATE FUNCTION f() RETURNS int AS $$ BEGIN; RETURN 1; END; $$ LANGUAGE plpgsql; SELECT 2";
        assert_eq!(
            texts(sql),
            [
                "CREATE FUNCTION f() RETURNS int AS $$ BEGIN; RETURN 1; END; $$ LANGUAGE plpgsql",
                "SELECT 2"
            ]
        );
        // Tagged dollar-quote; an inner `$$` must not close a `$body$`.
        assert_eq!(
            texts("SELECT $body$ a; $$ b; $body$ ; SELECT 9"),
            ["SELECT $body$ a; $$ b; $body$", "SELECT 9"]
        );
        // `$1$` is a positional param followed by text, not a dollar-quote opener.
        assert_eq!(texts("SELECT $1; SELECT 2"), ["SELECT $1", "SELECT 2"]);
    }

    #[test]
    fn statement_at_maps_cursor_to_containing_statement() {
        let sql = "SELECT 1;\nSELECT 2;\nSELECT 3";
        assert_eq!(statement_at(sql, 0).unwrap().text, "SELECT 1");
        // Inside the second statement.
        assert_eq!(statement_at(sql, 12).unwrap().text, "SELECT 2");
        // Past the end resolves to the last statement.
        assert_eq!(statement_at(sql, sql.len()).unwrap().text, "SELECT 3");
        assert!(statement_at("   ", 1).is_none());
    }

    #[test]
    fn multibyte_content_keeps_byte_offsets_valid() {
        // A `;` after a multi-byte string must still split cleanly.
        assert_eq!(
            texts("SELECT 'café; ☕'; SELECT 2"),
            ["SELECT 'café; ☕'", "SELECT 2"]
        );
    }
}
