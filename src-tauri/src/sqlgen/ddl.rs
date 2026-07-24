//! DDL SQL generation — pure text, parameterized by engine (no per-engine files
//! to keep in sync). Every statement is shown in the preview modal before it runs,
//! so this is a heavily unit-tested corpus. Identifiers go through `quote`; the
//! column `type_name`/`default` are raw, user-authored, and reviewed in the preview.

use crate::drivers::types::{ColumnSpec, DdlRequest, Engine};
use crate::sqlgen::{quote_ident, quote_qualified};
use crate::{AppError, AppResult};

pub fn generate(engine: Engine, req: &DdlRequest) -> AppResult<String> {
    match req {
        DdlRequest::CreateTable {
            namespace,
            name,
            columns,
            primary_key,
        } => {
            if columns.is_empty() {
                return Err(AppError::internal("a table needs at least one column"));
            }
            let table = quote_qualified(engine, namespace, name);
            let mut defs: Vec<String> = columns.iter().map(|c| column_def(engine, c)).collect();
            if !primary_key.is_empty() {
                let pk = primary_key
                    .iter()
                    .map(|c| quote_ident(engine, c))
                    .collect::<Vec<_>>()
                    .join(", ");
                defs.push(format!("PRIMARY KEY ({pk})"));
            }
            Ok(format!(
                "CREATE TABLE {table} (\n  {}\n)",
                defs.join(",\n  ")
            ))
        }
        DdlRequest::DropTable { namespace, name } => Ok(format!(
            "DROP TABLE {}",
            quote_qualified(engine, namespace, name)
        )),
        // pg / SQLite / MySQL 8 all accept `ALTER TABLE … RENAME TO <bare name>`.
        DdlRequest::RenameTable {
            namespace,
            name,
            new_name,
        } => Ok(format!(
            "ALTER TABLE {} RENAME TO {}",
            quote_qualified(engine, namespace, name),
            quote_ident(engine, new_name)
        )),
        DdlRequest::AddColumn {
            namespace,
            table,
            column,
        } => Ok(format!(
            "ALTER TABLE {} ADD COLUMN {}",
            quote_qualified(engine, namespace, table),
            column_def(engine, column)
        )),
        DdlRequest::DropColumn {
            namespace,
            table,
            column,
        } => Ok(format!(
            "ALTER TABLE {} DROP COLUMN {}",
            quote_qualified(engine, namespace, table),
            quote_ident(engine, column)
        )),
        DdlRequest::RenameColumn {
            namespace,
            table,
            from,
            to,
        } => Ok(format!(
            "ALTER TABLE {} RENAME COLUMN {} TO {}",
            quote_qualified(engine, namespace, table),
            quote_ident(engine, from),
            quote_ident(engine, to)
        )),
        DdlRequest::CreateIndex {
            namespace,
            table,
            name,
            columns,
            unique,
        } => {
            if columns.is_empty() {
                return Err(AppError::internal("an index needs at least one column"));
            }
            let cols = columns
                .iter()
                .map(|c| quote_ident(engine, c))
                .collect::<Vec<_>>()
                .join(", ");
            let uniq = if *unique { "UNIQUE " } else { "" };
            // SQLite attaches the schema to the index *name*, so its ON target must
            // be the bare table; pg/MySQL qualify the table instead.
            let on = match engine {
                Engine::Sqlite => quote_ident(engine, table),
                _ => quote_qualified(engine, namespace, table),
            };
            Ok(format!(
                "CREATE {uniq}INDEX {} ON {on} ({cols})",
                quote_ident(engine, name),
            ))
        }
        DdlRequest::DropIndex {
            namespace,
            table,
            name,
        } => match engine {
            // MySQL drops an index in the context of its table.
            Engine::MySql => Ok(format!(
                "DROP INDEX {} ON {}",
                quote_ident(engine, name),
                quote_qualified(engine, namespace, table)
            )),
            // A Postgres index lives in the schema; a SQLite index in the database.
            Engine::Postgres => Ok(format!(
                "DROP INDEX {}",
                quote_qualified(engine, namespace, name)
            )),
            Engine::Sqlite => Ok(format!("DROP INDEX {}", quote_ident(engine, name))),
        },
    }
}

fn column_def(engine: Engine, c: &ColumnSpec) -> String {
    let mut s = format!("{} {}", quote_ident(engine, &c.name), c.type_name);
    if !c.nullable {
        s.push_str(" NOT NULL");
    }
    if let Some(d) = &c.default {
        if !d.is_empty() {
            s.push_str(&format!(" DEFAULT {d}"));
        }
    }
    s
}

#[cfg(test)]
mod tests {
    use super::*;

    fn col(name: &str, ty: &str, nullable: bool) -> ColumnSpec {
        ColumnSpec {
            name: name.into(),
            type_name: ty.into(),
            nullable,
            default: None,
        }
    }

    #[test]
    fn create_table_quotes_and_appends_pk_per_engine() {
        let req = DdlRequest::CreateTable {
            namespace: "public".into(),
            name: "t".into(),
            columns: vec![col("id", "int", false), col("name", "text", true)],
            primary_key: vec!["id".into()],
        };
        assert_eq!(
            generate(Engine::Postgres, &req).unwrap(),
            "CREATE TABLE \"public\".\"t\" (\n  \"id\" int NOT NULL,\n  \"name\" text,\n  PRIMARY KEY (\"id\")\n)"
        );
        // MySQL uses backticks.
        assert!(generate(Engine::MySql, &req)
            .unwrap()
            .contains("CREATE TABLE `public`.`t`"));
    }

    #[test]
    fn create_table_needs_a_column() {
        let req = DdlRequest::CreateTable {
            namespace: "main".into(),
            name: "t".into(),
            columns: vec![],
            primary_key: vec![],
        };
        assert!(generate(Engine::Sqlite, &req).is_err());
    }

    #[test]
    fn default_expression_is_emitted() {
        let c = ColumnSpec {
            name: "n".into(),
            type_name: "int".into(),
            nullable: false,
            default: Some("0".into()),
        };
        let req = DdlRequest::AddColumn {
            namespace: "public".into(),
            table: "t".into(),
            column: c,
        };
        assert_eq!(
            generate(Engine::Postgres, &req).unwrap(),
            "ALTER TABLE \"public\".\"t\" ADD COLUMN \"n\" int NOT NULL DEFAULT 0"
        );
    }

    #[test]
    fn rename_and_drop_column() {
        let rename = DdlRequest::RenameColumn {
            namespace: "public".into(),
            table: "t".into(),
            from: "a".into(),
            to: "b".into(),
        };
        assert_eq!(
            generate(Engine::Sqlite, &rename).unwrap(),
            "ALTER TABLE \"public\".\"t\" RENAME COLUMN \"a\" TO \"b\""
        );
        let drop = DdlRequest::DropColumn {
            namespace: "public".into(),
            table: "t".into(),
            column: "c".into(),
        };
        assert_eq!(
            generate(Engine::MySql, &drop).unwrap(),
            "ALTER TABLE `public`.`t` DROP COLUMN `c`"
        );
    }

    #[test]
    fn create_unique_index() {
        let req = DdlRequest::CreateIndex {
            namespace: "public".into(),
            table: "t".into(),
            name: "t_a_idx".into(),
            columns: vec!["a".into(), "b".into()],
            unique: true,
        };
        assert_eq!(
            generate(Engine::Postgres, &req).unwrap(),
            "CREATE UNIQUE INDEX \"t_a_idx\" ON \"public\".\"t\" (\"a\", \"b\")"
        );
        // Regression: SQLite rejects a schema-qualified table in CREATE INDEX.
        assert_eq!(
            generate(Engine::Sqlite, &req).unwrap(),
            "CREATE UNIQUE INDEX \"t_a_idx\" ON \"t\" (\"a\", \"b\")"
        );
    }

    #[test]
    fn drop_index_differs_by_engine() {
        let req = DdlRequest::DropIndex {
            namespace: "public".into(),
            table: "t".into(),
            name: "t_a_idx".into(),
        };
        assert_eq!(
            generate(Engine::MySql, &req).unwrap(),
            "DROP INDEX `t_a_idx` ON `public`.`t`"
        );
        assert_eq!(
            generate(Engine::Postgres, &req).unwrap(),
            "DROP INDEX \"public\".\"t_a_idx\""
        );
        assert_eq!(
            generate(Engine::Sqlite, &req).unwrap(),
            "DROP INDEX \"t_a_idx\""
        );
    }
}
