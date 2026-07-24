//! MySQL cell decode — the single edge-type site for MySQL. Driven by the SQL
//! type name. DECIMAL and `BIGINT UNSIGNED` stay strings (precision > i64/f64);
//! `TINYINT(1)` booleans arrive as `TINYINT` and render as 0/1 (the `(1)` width
//! is not in the type name — the column's declared type carries it for display);
//! ENUM/SET decode as `Text`.

use serde_json::Value;
use sqlx::mysql::MySqlRow;
use sqlx::types::chrono::{NaiveDate, NaiveDateTime, NaiveTime};
use sqlx::types::BigDecimal;
use sqlx::{Column, Row, TypeInfo, ValueRef};

use crate::drivers::types::{BytesPreview, CellValue, ColumnInfo, UnknownValue};

pub fn columns(row: &MySqlRow) -> Vec<ColumnInfo> {
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

pub fn decode_row(row: &MySqlRow) -> Vec<CellValue> {
    row.columns()
        .iter()
        .enumerate()
        .map(|(i, c)| decode_cell(row, i, c.type_info().name()))
        .collect()
}

fn decode_cell(row: &MySqlRow, i: usize, type_name: &str) -> CellValue {
    if matches!(row.try_get_raw(i), Ok(v) if v.is_null()) {
        return CellValue::Null;
    }
    match type_name {
        // sqlx reports MySQL `TINYINT(1)` as BOOLEAN; wider tinyints stay ints.
        "BOOLEAN" => get(row.try_get::<bool, _>(i).map(CellValue::Bool), type_name),
        "TINYINT" => get(
            row.try_get::<i8, _>(i).map(|v| CellValue::Int(v as i64)),
            type_name,
        ),
        "SMALLINT" | "YEAR" => get(
            row.try_get::<i16, _>(i).map(|v| CellValue::Int(v as i64)),
            type_name,
        ),
        "INT" | "MEDIUMINT" => get(
            row.try_get::<i32, _>(i).map(|v| CellValue::Int(v as i64)),
            type_name,
        ),
        "BIGINT" => get(row.try_get::<i64, _>(i).map(CellValue::Int), type_name),
        "TINYINT UNSIGNED" | "SMALLINT UNSIGNED" | "MEDIUMINT UNSIGNED" | "INT UNSIGNED" => get(
            row.try_get::<u32, _>(i).map(|v| CellValue::Int(v as i64)),
            type_name,
        ),
        // u64 can exceed i64 → keep exact as a decimal string.
        "BIGINT UNSIGNED" => get(
            row.try_get::<u64, _>(i)
                .map(|v| CellValue::Decimal(v.to_string())),
            type_name,
        ),
        "FLOAT" => get(
            row.try_get::<f32, _>(i).map(|v| CellValue::Float(v as f64)),
            type_name,
        ),
        "DOUBLE" => get(row.try_get::<f64, _>(i).map(CellValue::Float), type_name),
        "DECIMAL" => get(
            row.try_get::<BigDecimal, _>(i)
                .map(|v| CellValue::Decimal(v.to_string())),
            type_name,
        ),
        "VARCHAR" | "CHAR" | "TEXT" | "TINYTEXT" | "MEDIUMTEXT" | "LONGTEXT" | "ENUM" | "SET" => {
            get(row.try_get::<String, _>(i).map(CellValue::Text), type_name)
        }
        "JSON" => get(row.try_get::<Value, _>(i).map(CellValue::Json), type_name),
        "DATE" => get(
            row.try_get::<NaiveDate, _>(i)
                .map(|v| CellValue::Date(v.to_string())),
            type_name,
        ),
        "DATETIME" | "TIMESTAMP" => get(
            row.try_get::<NaiveDateTime, _>(i)
                .map(|v| CellValue::DateTime(v.format("%Y-%m-%dT%H:%M:%S%.f").to_string())),
            type_name,
        ),
        "TIME" => row
            .try_get::<NaiveTime, _>(i)
            .map(|v| CellValue::Time(v.to_string()))
            .or_else(|_| row.try_get::<String, _>(i).map(CellValue::Text))
            .unwrap_or_else(|_| unknown(type_name)),
        "BLOB" | "TINYBLOB" | "MEDIUMBLOB" | "LONGBLOB" | "VARBINARY" | "BINARY" => get(
            row.try_get::<Vec<u8>, _>(i)
                .map(|v| CellValue::Bytes(BytesPreview::from_bytes(&v))),
            type_name,
        ),
        _ => row
            .try_get::<String, _>(i)
            .map(CellValue::Text)
            .unwrap_or_else(|_| unknown(type_name)),
    }
}

fn get(decoded: Result<CellValue, sqlx::Error>, type_name: &str) -> CellValue {
    decoded.unwrap_or_else(|_| unknown(type_name))
}

fn unknown(type_name: &str) -> CellValue {
    CellValue::Unknown(UnknownValue {
        type_name: type_name.to_string(),
        display: String::new(),
    })
}
