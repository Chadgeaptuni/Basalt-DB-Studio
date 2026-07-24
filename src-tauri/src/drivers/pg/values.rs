//! Postgres cell decode — the single edge-type site for Postgres. Decode is
//! driven by the column's SQL type name. NUMERIC keeps full precision as a
//! string; timestamps preserve their offset; enums (and any unmatched but
//! text-castable type) decode as `Text`; everything else falls back to `Unknown`.

use serde_json::Value;
use sqlx::postgres::PgRow;
use sqlx::types::chrono::{DateTime, FixedOffset, NaiveDate, NaiveDateTime, NaiveTime};
use sqlx::types::{BigDecimal, Uuid};
use sqlx::{Column, Postgres, QueryBuilder, Row, TypeInfo, ValueRef};

use crate::drivers::types::{BytesPreview, CellValue, ColumnInfo, UnknownValue};

pub fn columns(row: &PgRow) -> Vec<ColumnInfo> {
    row.columns()
        .iter()
        .map(|c| ColumnInfo {
            name: c.name().to_string(),
            type_name: c.type_info().name().to_string(),
            nullable: true,
            is_pk: false,
        })
        .collect()
}

pub fn decode_row(row: &PgRow) -> Vec<CellValue> {
    row.columns()
        .iter()
        .enumerate()
        .map(|(i, c)| decode_cell(row, i, c.type_info().name()))
        .collect()
}

fn decode_cell(row: &PgRow, i: usize, type_name: &str) -> CellValue {
    if matches!(row.try_get_raw(i), Ok(v) if v.is_null()) {
        return CellValue::Null;
    }
    match type_name {
        "BOOL" => get(row.try_get::<bool, _>(i).map(CellValue::Bool), type_name),
        "INT2" => get(
            row.try_get::<i16, _>(i).map(|v| CellValue::Int(v as i64)),
            type_name,
        ),
        "INT4" => get(
            row.try_get::<i32, _>(i).map(|v| CellValue::Int(v as i64)),
            type_name,
        ),
        "INT8" => get(row.try_get::<i64, _>(i).map(CellValue::Int), type_name),
        "FLOAT4" => get(
            row.try_get::<f32, _>(i).map(|v| CellValue::Float(v as f64)),
            type_name,
        ),
        "FLOAT8" => get(row.try_get::<f64, _>(i).map(CellValue::Float), type_name),
        "NUMERIC" => get(
            row.try_get::<BigDecimal, _>(i)
                .map(|v| CellValue::Decimal(trim_numeric(v.to_string()))),
            type_name,
        ),
        "TEXT" | "VARCHAR" | "BPCHAR" | "CHAR" | "NAME" | "CITEXT" => {
            get(row.try_get::<String, _>(i).map(CellValue::Text), type_name)
        }
        "JSON" | "JSONB" => get(row.try_get::<Value, _>(i).map(CellValue::Json), type_name),
        "UUID" => get(
            row.try_get::<Uuid, _>(i)
                .map(|v| CellValue::Text(v.to_string())),
            type_name,
        ),
        "DATE" => get(
            row.try_get::<NaiveDate, _>(i)
                .map(|v| CellValue::Date(v.to_string())),
            type_name,
        ),
        "TIME" => get(
            row.try_get::<NaiveTime, _>(i)
                .map(|v| CellValue::Time(v.to_string())),
            type_name,
        ),
        "TIMESTAMP" => get(
            row.try_get::<NaiveDateTime, _>(i)
                .map(|v| CellValue::DateTime(v.format("%Y-%m-%dT%H:%M:%S%.f").to_string())),
            type_name,
        ),
        "TIMESTAMPTZ" => get(
            row.try_get::<DateTime<FixedOffset>, _>(i)
                .map(|v| CellValue::DateTime(v.to_rfc3339())),
            type_name,
        ),
        "BYTEA" => get(
            row.try_get::<Vec<u8>, _>(i)
                .map(|v| CellValue::Bytes(BytesPreview::from_bytes(&v))),
            type_name,
        ),
        "INT4[]" => get(
            row.try_get::<Vec<i32>, _>(i).map(|v| {
                CellValue::Array(v.into_iter().map(|x| CellValue::Int(x as i64)).collect())
            }),
            type_name,
        ),
        "INT8[]" => get(
            row.try_get::<Vec<i64>, _>(i)
                .map(|v| CellValue::Array(v.into_iter().map(CellValue::Int).collect())),
            type_name,
        ),
        "FLOAT8[]" => get(
            row.try_get::<Vec<f64>, _>(i)
                .map(|v| CellValue::Array(v.into_iter().map(CellValue::Float).collect())),
            type_name,
        ),
        "BOOL[]" => get(
            row.try_get::<Vec<bool>, _>(i)
                .map(|v| CellValue::Array(v.into_iter().map(CellValue::Bool).collect())),
            type_name,
        ),
        "TEXT[]" | "VARCHAR[]" => get(
            row.try_get::<Vec<String>, _>(i)
                .map(|v| CellValue::Array(v.into_iter().map(CellValue::Text).collect())),
            type_name,
        ),
        // Enums and other text-transmitted types: read the raw value as UTF-8 (a
        // pg enum's binary form is its label). Non-text binary → Unknown.
        _ => decode_text_bytes(row, i, type_name),
    }
}

/// Best-effort text for a type without a typed decoder: the raw value bytes as
/// UTF-8 (covers enums and other text-encoded types); binary payloads → Unknown.
fn decode_text_bytes(row: &PgRow, i: usize, type_name: &str) -> CellValue {
    let Ok(value) = row.try_get_raw(i) else {
        return unknown(type_name);
    };
    match value.as_bytes() {
        Ok(bytes) => match std::str::from_utf8(bytes) {
            Ok(s) => CellValue::Text(s.to_string()),
            Err(_) => unknown(type_name),
        },
        Err(_) => unknown(type_name),
    }
}

/// Uses a decoded cell, or falls back to `Unknown` if the typed decode failed.
fn get(decoded: Result<CellValue, sqlx::Error>, type_name: &str) -> CellValue {
    decoded.unwrap_or_else(|_| unknown(type_name))
}

fn unknown(type_name: &str) -> CellValue {
    CellValue::Unknown(UnknownValue {
        type_name: type_name.to_string(),
        display: String::new(),
    })
}

/// Postgres sends binary numeric in base-10000 groups, so sqlx's `BigDecimal` can
/// carry more trailing zeros than the value's display scale (`2.75` → `"2.7500"`).
/// Trim the spurious fractional zeros for display; the value is unchanged. Exact
/// display scale (keeping `"2.50"`) would need the raw `PgNumeric` dscale — deferred.
fn trim_numeric(s: String) -> String {
    if !s.contains('.') {
        return s;
    }
    s.trim_end_matches('0').trim_end_matches('.').to_string()
}

/// Binds a cell for a grid write (reverse of decode). Postgres is bound as text
/// plus an explicit `::type_name` cast, which lets it coerce uniformly into
/// numeric/json/array/enum/date columns without a per-type encoder. `type_name`
/// is the column's introspected type (`integer`, `jsonb`, `integer[]`, …).
pub fn bind_cell(qb: &mut QueryBuilder<Postgres>, value: &CellValue, type_name: &str) {
    qb.push_bind(pg_text(value));
    if !type_name.is_empty() {
        qb.push("::").push(type_name);
    }
}

/// The text Postgres will cast. `None` → SQL NULL. Binary/Unknown are read-only
/// (validated out before commit) and map to NULL defensively.
fn pg_text(value: &CellValue) -> Option<String> {
    match value {
        CellValue::Null | CellValue::Bytes(_) | CellValue::Unknown(_) => None,
        CellValue::Bool(b) => Some(if *b { "true" } else { "false" }.to_string()),
        CellValue::Int(i) => Some(i.to_string()),
        CellValue::Float(f) => Some(f.to_string()),
        CellValue::Text(s)
        | CellValue::Decimal(s)
        | CellValue::Date(s)
        | CellValue::Time(s)
        | CellValue::DateTime(s) => Some(s.clone()),
        CellValue::Json(v) => Some(v.to_string()),
        CellValue::Array(items) => Some(pg_array_literal(items)),
    }
}

/// A Postgres array literal (`{"a","b",NULL}`); every element is double-quoted and
/// escaped, which parses correctly for numeric element types too.
fn pg_array_literal(items: &[CellValue]) -> String {
    let mut out = String::from("{");
    for (i, item) in items.iter().enumerate() {
        if i > 0 {
            out.push(',');
        }
        match pg_text(item) {
            None => out.push_str("NULL"),
            Some(s) => {
                out.push('"');
                out.push_str(&s.replace('\\', "\\\\").replace('"', "\\\""));
                out.push('"');
            }
        }
    }
    out.push('}');
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn trim_numeric_drops_only_spurious_fractional_zeros() {
        // Regression: pg binary numeric over-pads (2.75 → "2.7500").
        assert_eq!(trim_numeric("2.7500".into()), "2.75");
        assert_eq!(trim_numeric("2.5000".into()), "2.5");
        assert_eq!(trim_numeric("2.00".into()), "2");
        assert_eq!(trim_numeric("0.00".into()), "0");
        assert_eq!(trim_numeric("12345.6789".into()), "12345.6789");
        // Integer trailing zeros are significant — never touched.
        assert_eq!(trim_numeric("1000".into()), "1000");
        assert_eq!(trim_numeric("-0.50".into()), "-0.5");
    }

    #[test]
    fn pg_array_literal_quotes_and_escapes() {
        let arr = [
            CellValue::Int(1),
            CellValue::Null,
            CellValue::Text("a\"b".into()),
        ];
        assert_eq!(pg_array_literal(&arr), "{\"1\",NULL,\"a\\\"b\"}");
    }
}
