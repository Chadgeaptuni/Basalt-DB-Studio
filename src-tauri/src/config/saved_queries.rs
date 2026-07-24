//! Saved queries: one `.sql` file per query under `queries/`, in nestable
//! folders (subdirectories) for clean git diffs. A query's identity is its
//! relative path (folder segments joined by `/`, no `.sql` suffix in the wire
//! form). Pure filesystem — no secrets, so this is a git-sync unit like
//! `connections/`.

use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::config::Paths;
use crate::{AppError, AppResult};

/// A saved query in the tree. `path` is folder-relative with `/` separators and
/// no extension (e.g. `reports/daily-active`); `name` is its last segment.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SavedQuery {
    pub path: String,
    pub name: String,
}

/// Walk `queries/` and return every `.sql` file as a `SavedQuery`, sorted by path.
pub fn list(paths: &Paths) -> AppResult<Vec<SavedQuery>> {
    let root = &paths.queries_dir;
    if !root.exists() {
        return Ok(Vec::new());
    }
    let mut out = Vec::new();
    walk(root, root, &mut out)?;
    out.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(out)
}

fn walk(root: &Path, dir: &Path, out: &mut Vec<SavedQuery>) -> AppResult<()> {
    for entry in fs::read_dir(dir).map_err(io_err)? {
        let path = entry.map_err(io_err)?.path();
        if path.is_dir() {
            walk(root, &path, out)?;
        } else if path.extension().and_then(|e| e.to_str()) == Some("sql") {
            let rel = path
                .strip_prefix(root)
                .map_err(AppError::internal)?
                .with_extension("");
            let wire = rel.to_string_lossy().replace('\\', "/");
            let name = rel
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_else(|| wire.clone());
            out.push(SavedQuery { path: wire, name });
        }
    }
    Ok(())
}

pub fn read(paths: &Paths, path: &str) -> AppResult<String> {
    let file = query_path(paths, path)?;
    fs::read_to_string(&file).map_err(|e| AppError::ConfigIo(format!("query '{path}': {e}")))
}

pub fn save(paths: &Paths, path: &str, sql: &str) -> AppResult<()> {
    let file = query_path(paths, path)?;
    if let Some(parent) = file.parent() {
        fs::create_dir_all(parent).map_err(io_err)?;
    }
    fs::write(&file, sql).map_err(io_err)
}

pub fn delete(paths: &Paths, path: &str) -> AppResult<()> {
    let file = query_path(paths, path)?;
    if file.exists() {
        fs::remove_file(&file).map_err(io_err)?;
    }
    Ok(())
}

/// Map a wire path to its `.sql` file, rejecting anything that escapes `queries/`.
/// Folder segments are allowed; `.`/`..` and absolute/backslash paths are not.
fn query_path(paths: &Paths, path: &str) -> AppResult<PathBuf> {
    let bad = path.is_empty()
        || path.starts_with('/')
        || path.contains('\\')
        || path
            .split('/')
            .any(|seg| seg.is_empty() || seg == "." || seg == "..");
    if bad {
        return Err(AppError::ConfigParse(format!(
            "invalid query path: '{path}'"
        )));
    }
    Ok(paths.queries_dir.join(format!("{path}.sql")))
}

fn io_err(e: std::io::Error) -> AppError {
    AppError::ConfigIo(e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_paths() -> Paths {
        Paths::under(std::env::temp_dir().join(format!("basalt-q-{}", uuid::Uuid::new_v4())))
    }

    #[test]
    fn save_read_list_delete_round_trips_nested() {
        let paths = temp_paths();
        save(&paths, "top", "select 1;").unwrap();
        save(&paths, "reports/daily", "select count(*) from t;").unwrap();

        assert_eq!(
            read(&paths, "reports/daily").unwrap(),
            "select count(*) from t;"
        );

        let listed = list(&paths).unwrap();
        assert_eq!(
            listed,
            vec![
                SavedQuery {
                    path: "reports/daily".into(),
                    name: "daily".into()
                },
                SavedQuery {
                    path: "top".into(),
                    name: "top".into()
                },
            ]
        );

        delete(&paths, "top").unwrap();
        assert_eq!(list(&paths).unwrap().len(), 1);

        fs::remove_dir_all(&paths.config_dir).ok();
    }

    #[test]
    fn list_missing_dir_is_empty() {
        assert!(list(&temp_paths()).unwrap().is_empty());
    }

    #[test]
    fn path_traversal_is_rejected() {
        let paths = temp_paths();
        for bad in ["../evil", "a/../../etc", "", "/abs", "a//b", "a/./b"] {
            assert_eq!(
                query_path(&paths, bad).unwrap_err().kind(),
                "configParse",
                "should reject {bad}"
            );
        }
    }
}
