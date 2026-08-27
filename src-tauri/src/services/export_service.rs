//! Streams a query's full result to a CSV or JSON file. The query is re-run (so
//! the export is complete even when the on-screen grid was row-limited), rows are
//! written as they arrive, and progress is reported through `progress` every few
//! thousand rows. CSV/JSON are hand-written (no serialization crate needed).

use std::fs::File;
use std::io::{BufWriter, Write};

use serde_json::Value;

use crate::drivers::export::RowSink;
use crate::drivers::types::{CellValue, ColumnInfo, ExportFormat};
use crate::services::connection_service::{session_driver, SessionRegistry};
use crate::sqlgen::{quote_ident, quote_qualified};
use crate::{AppError, AppResult};

const PROGRESS_EVERY: u64 = 5000;

/// Exports a whole table (all rows) — builds the engine-quoted `SELECT` so the
/// frontend needn't know quoting, then streams like any query.
pub async fn export_table(
    session_id: &str,
    namespace: &str,
    table: &str,
    format: ExportFormat,
    path: &str,
    progress: &(dyn Fn(u64) + Send + Sync),
    registry: &SessionRegistry,
) -> AppResult<u64> {
    let (driver, _read_only) = session_driver(session_id, registry).await?;
    let engine = driver.engine();
    let desc = driver.describe_table(namespace, table).await?;
    let cols = desc
        .columns
        .iter()
        .map(|c| quote_ident(engine, &c.name))
        .collect::<Vec<_>>()
        .join(", ");
    let sql = format!(
        "SELECT {cols} FROM {}",
        quote_qualified(engine, namespace, table)
    );
    export(session_id, &sql, format, path, progress, registry).await
}

pub async fn export(
    session_id: &str,
    sql: &str,
    format: ExportFormat,
    path: &str,
    progress: &(dyn Fn(u64) + Send + Sync),
    registry: &SessionRegistry,
) -> AppResult<u64> {
    let (driver, _read_only) = session_driver(session_id, registry).await?;
    let file = File::create(path)
        .map_err(|e| AppError::internal(format!("cannot create export file: {e}")))?;
    let writer = BufWriter::new(file);

    let total = match format {
        ExportFormat::Csv => {
            let mut sink = CsvSink {
                w: writer,
                progress,
                n: 0,
            };
            let n = driver.export_rows(sql, &mut sink).await?;
            sink.w.flush().map_err(AppError::internal)?;
            n
        }
        ExportFormat::Json => {
            let mut sink = JsonSink {
                w: writer,
                progress,
                n: 0,
                columns: Vec::new(),
                started: false,
            };
            let n = driver.export_rows(sql, &mut sink).await?;
            sink.finish()?;
            n
        }
    };
    Ok(total)
}

// ── CSV ───────────────────────────────────────────────────────────────────────

struct CsvSink<'a, W: Write> {
    w: W,
    progress: &'a (dyn Fn(u64) + Send + Sync),
    n: u64,
}

impl<W: Write> RowSink for CsvSink<'_, W> {
    fn header(&mut self, columns: &[ColumnInfo]) -> AppResult<()> {
        let line = columns
            .iter()
            .map(|c| csv_field(&c.name))
            .collect::<Vec<_>>()
            .join(",");
        writeln!(self.w, "{line}").map_err(AppError::internal)
    }

    fn row(&mut self, cells: &[CellValue]) -> AppResult<()> {
        let line = cells
            .iter()
            .map(|c| csv_field(&cell_text(c)))
            .collect::<Vec<_>>()
            .join(",");
        writeln!(self.w, "{line}").map_err(AppError::internal)?;
        self.n += 1;
        if self.n.is_multiple_of(PROGRESS_EVERY) {
            (self.progress)(self.n);
        }
        Ok(())
    }
}

/// RFC4180 quoting: wrap in `"` and double embedded quotes when the field holds a
/// comma, quote, or newline.
fn csv_field(s: &str) -> String {
    if s.contains([',', '"', '\n', '\r']) {
        format!("\"{}\"", s.replace('"', "\"\""))
    } else {
        s.to_string()
    }
}

// ── JSON ──────────────────────────────────────────────────────────────────────

struct JsonSink<'a, W: Write> {
    w: W,
    progress: &'a (dyn Fn(u64) + Send + Sync),
    n: u64,
    columns: Vec<String>,
    started: bool,
}

impl<W: Write> JsonSink<'_, W> {
    fn finish(&mut self) -> AppResult<()> {
        if !self.started {
            write!(self.w, "[]").map_err(AppError::internal)?;
        } else {
            write!(self.w, "]").map_err(AppError::internal)?;
        }
        self.w.flush().map_err(AppError::internal)
    }
}

impl<W: Write> RowSink for JsonSink<'_, W> {
    fn header(&mut self, columns: &[ColumnInfo]) -> AppResult<()> {
        self.columns = columns.iter().map(|c| c.name.clone()).collect();
        Ok(())
    }

    fn row(&mut self, cells: &[CellValue]) -> AppResult<()> {
        // Objects are written by hand to preserve column order (serde_json's Map is
        // sorted without the preserve_order feature).
        write!(self.w, "{}", if self.started { "," } else { "[" }).map_err(AppError::internal)?;
        self.started = true;
        write!(self.w, "{{").map_err(AppError::internal)?;
        for (i, (name, cell)) in self.columns.iter().zip(cells).enumerate() {
            if i > 0 {
                write!(self.w, ",").map_err(AppError::internal)?;
            }
            serde_json::to_writer(&mut self.w, name).map_err(AppError::internal)?;
            write!(self.w, ":").map_err(AppError::internal)?;
            serde_json::to_writer(&mut self.w, &cell_json(cell)).map_err(AppError::internal)?;
        }
        write!(self.w, "}}").map_err(AppError::internal)?;
        self.n += 1;
        if self.n.is_multiple_of(PROGRESS_EVERY) {
            (self.progress)(self.n);
        }
        Ok(())
    }
}

/// Plain text for a cell in CSV (NULL → empty).
fn cell_text(cell: &CellValue) -> String {
    match cell {
        CellValue::Null => String::new(),
        CellValue::Bool(b) => b.to_string(),
        CellValue::Int(i) => i.to_string(),
        CellValue::Float(f) => f.to_string(),
        CellValue::Text(s)
        | CellValue::Decimal(s)
        | CellValue::Date(s)
        | CellValue::Time(s)
        | CellValue::DateTime(s) => s.clone(),
        CellValue::Json(v) => v.to_string(),
        CellValue::Bytes(b) => format!("\\x{}", b.preview),
        CellValue::Array(_) => cell_json(cell).to_string(),
        CellValue::Unknown(u) => {
            if u.display.is_empty() {
                u.type_name.clone()
            } else {
                u.display.clone()
            }
        }
    }
}

/// A JSON value for a cell (NULL → json null; Decimal/Bytes stay strings).
fn cell_json(cell: &CellValue) -> Value {
    match cell {
        CellValue::Null => Value::Null,
        CellValue::Bool(b) => Value::Bool(*b),
        CellValue::Int(i) => Value::from(*i),
        CellValue::Float(f) => serde_json::Number::from_f64(*f).map_or(Value::Null, Value::Number),
        CellValue::Text(s)
        | CellValue::Decimal(s)
        | CellValue::Date(s)
        | CellValue::Time(s)
        | CellValue::DateTime(s) => Value::String(s.clone()),
        CellValue::Json(v) => v.clone(),
        CellValue::Bytes(b) => Value::String(format!("\\x{}", b.preview)),
        CellValue::Array(items) => Value::Array(items.iter().map(cell_json).collect()),
        CellValue::Unknown(u) => Value::String(if u.display.is_empty() {
            u.type_name.clone()
        } else {
            u.display.clone()
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn csv_quoting() {
        assert_eq!(csv_field("plain"), "plain");
        assert_eq!(csv_field("a,b"), "\"a,b\"");
        assert_eq!(csv_field("he\"llo"), "\"he\"\"llo\"");
        assert_eq!(cell_text(&CellValue::Null), "");
    }

    #[test]
    fn json_values() {
        assert_eq!(cell_json(&CellValue::Null), Value::Null);
        assert_eq!(cell_json(&CellValue::Int(5)), Value::from(5));
        // Decimals stay strings to keep precision.
        assert_eq!(
            cell_json(&CellValue::Decimal("2.50".into())),
            Value::String("2.50".into())
        );
    }

    use crate::config::connections::ConnectionProfile;
    use crate::drivers::types::{Engine, ExportFormat};
    use crate::services::connection_service;
    use std::collections::HashMap;
    use tokio::sync::Mutex;

    async fn session() -> (String, SessionRegistry) {
        use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
        let path = std::env::temp_dir()
            .join(format!("basalt-exp-{}.db", uuid::Uuid::new_v4()))
            .to_string_lossy()
            .into_owned();
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(
                SqliteConnectOptions::new()
                    .filename(&path)
                    .create_if_missing(true),
            )
            .await
            .unwrap();
        for s in [
            "CREATE TABLE t (id INTEGER, name TEXT)",
            "INSERT INTO t VALUES (1, 'a,b'), (2, NULL)",
        ] {
            sqlx::query(sqlx::AssertSqlSafe(s.to_string()))
                .execute(&pool)
                .await
                .unwrap();
        }
        pool.close().await;
        let profile = ConnectionProfile {
            id: "e".into(),
            name: "e".into(),
            engine: Engine::Sqlite,
            environment: None,
            host: None,
            port: None,
            database: None,
            username: None,
            file_path: Some(path),
            read_only: false,
            connect_timeout_secs: Some(5),
            secret_ref: None,
            tls: None,
            ssh: None,
        };
        let registry: SessionRegistry = Mutex::new(HashMap::new());
        let info = connection_service::connect(&profile, None, None, &registry)
            .await
            .unwrap();
        (info.session_id, registry)
    }

    #[tokio::test]
    async fn exports_csv_and_json() {
        let (sid, reg) = session().await;
        let noop = |_: u64| {};

        let csv_path = std::env::temp_dir()
            .join(format!("basalt-exp-{}.csv", uuid::Uuid::new_v4()))
            .to_string_lossy()
            .into_owned();
        let n = export(
            &sid,
            "SELECT id, name FROM t ORDER BY id",
            ExportFormat::Csv,
            &csv_path,
            &noop,
            &reg,
        )
        .await
        .unwrap();
        assert_eq!(n, 2);
        // Header + quoted comma field + empty NULL field.
        assert_eq!(
            std::fs::read_to_string(&csv_path).unwrap(),
            "id,name\n1,\"a,b\"\n2,\n"
        );

        let json_path = std::env::temp_dir()
            .join(format!("basalt-exp-{}.json", uuid::Uuid::new_v4()))
            .to_string_lossy()
            .into_owned();
        export(
            &sid,
            "SELECT id, name FROM t ORDER BY id",
            ExportFormat::Json,
            &json_path,
            &noop,
            &reg,
        )
        .await
        .unwrap();
        let json = std::fs::read_to_string(&json_path).unwrap();
        assert_eq!(json, r#"[{"id":1,"name":"a,b"},{"id":2,"name":null}]"#);
    }
}
