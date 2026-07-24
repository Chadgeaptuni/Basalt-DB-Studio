//! SQLite cell decode — the single edge-type site for SQLite. SQLite is
//! dynamically typed, so cells decode by the value's *runtime* storage class
//! (INTEGER/REAL/TEXT/BLOB/NULL), not the column's declared affinity. Dates and
//! booleans have no native type — they arrive as their stored class (text/int)
//! and render as such, matching how SQLite itself sees them.

use sqlx::sqlite::SqliteRow;
use sqlx::{Column, Row, TypeInfo, ValueRef};

use crate::drivers::types::{BytesPreview, CellValue, ColumnInfo, UnknownValue};

pub fn columns(row: &SqliteRow) -> Vec<ColumnInfo> {
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

pub fn decode_row(row: &SqliteRow) -> Vec<CellValue> {
    (0..row.columns().len())
        .map(|i| decode_cell(row, i))
        .collect()
}

fn decode_cell(row: &SqliteRow, i: usize) -> CellValue {
    let type_name = match row.try_get_raw(i) {
        Ok(v) if v.is_null() => return CellValue::Null,
        Ok(v) => v.type_info().name().to_string(),
        Err(_) => return CellValue::Null,
    };
    match type_name.as_str() {
        "INTEGER" | "BOOLEAN" => row
            .try_get::<i64, _>(i)
            .map(CellValue::Int)
            .unwrap_or_else(|_| unknown(&type_name)),
        "REAL" => row
            .try_get::<f64, _>(i)
            .map(CellValue::Float)
            .unwrap_or_else(|_| unknown(&type_name)),
        "TEXT" => row
            .try_get::<String, _>(i)
            .map(CellValue::Text)
            .unwrap_or_else(|_| unknown(&type_name)),
        "BLOB" => row
            .try_get::<Vec<u8>, _>(i)
            .map(|v| CellValue::Bytes(BytesPreview::from_bytes(&v)))
            .unwrap_or_else(|_| unknown(&type_name)),
        // NUMERIC affinity may surface as any class; keep exact via text.
        _ => row
            .try_get::<String, _>(i)
            .map(CellValue::Text)
            .or_else(|_| row.try_get::<i64, _>(i).map(CellValue::Int))
            .or_else(|_| row.try_get::<f64, _>(i).map(CellValue::Float))
            .unwrap_or_else(|_| unknown(&type_name)),
    }
}

fn unknown(type_name: &str) -> CellValue {
    CellValue::Unknown(UnknownValue {
        type_name: type_name.to_string(),
        display: String::new(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    #[tokio::test]
    async fn decodes_each_storage_class_and_null() {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .unwrap();
        let row = sqlx::query("SELECT 42 AS i, 3.5 AS r, 'hi' AS t, x'deadbeef' AS b, NULL AS n")
            .fetch_one(&pool)
            .await
            .unwrap();

        let cells = decode_row(&row);
        assert_eq!(cells[0], CellValue::Int(42));
        assert_eq!(cells[1], CellValue::Float(3.5));
        assert_eq!(cells[2], CellValue::Text("hi".into()));
        assert_eq!(
            cells[3],
            CellValue::Bytes(BytesPreview {
                len: 4,
                preview: "deadbeef".into()
            })
        );
        assert_eq!(cells[4], CellValue::Null);

        let meta = columns(&row);
        assert_eq!(
            meta.iter().map(|c| c.name.as_str()).collect::<Vec<_>>(),
            ["i", "r", "t", "b", "n"]
        );
    }
}
