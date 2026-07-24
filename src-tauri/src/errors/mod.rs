//! The single application error type. Every `#[tauri::command]` returns
//! `Result<T, AppError>`; on error Tauri serializes it as
//! `ErrorResponse { kind, message, detail }` and the frontend switches on
//! `kind` (never on `message`). A new failure mode is a new variant here and a
//! new member of the `ErrorKind` union in `src/lib/api/types.ts` — never a
//! stringly-typed collapse into a generic error.

use serde::Serialize;
use serde_json::Value;

pub type AppResult<T> = Result<T, AppError>;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("{0}")]
    ConnectionRefused(String),

    #[error("{0}")]
    AuthFailed(String),

    #[error("{0}")]
    TlsError(String),

    #[error("{0}")]
    TunnelError(String),

    /// `detail` carries `{ code, position }` so the editor can underline the
    /// offending token.
    #[error("{message}")]
    QueryError {
        message: String,
        detail: Option<Value>,
    },

    #[error("{0}")]
    QueryCancelled(String),

    #[error("{0}")]
    ReadOnlyViolation(String),

    #[error("{0}")]
    NoPrimaryKey(String),

    /// A grid UPDATE/DELETE matched ≠ 1 row (no PK, non-unique identity). `detail`
    /// carries the failing edit `index` so the frontend can highlight that row.
    #[error("{message}")]
    AmbiguousRowIdentity { message: String, index: usize },

    /// Not rendered as an error UI — the frontend runs `confirm()` and re-invokes
    /// with `confirmed: true`. `detail` carries the classified statements.
    #[error("confirmation required")]
    ConfirmationRequired { detail: Value },

    #[error("{0}")]
    SecretNotFound(String),

    #[error("{0}")]
    KeychainUnavailable(String),

    #[error("{0}")]
    VaultLocked(String),

    #[error("{0}")]
    ConfigIo(String),

    #[error("{0}")]
    ConfigParse(String),

    #[error("{0}")]
    GitNotInstalled(String),

    #[error("{0}")]
    GitConflict(String),

    #[error("{0}")]
    GitDirty(String),

    /// `detail` carries `{ line }`.
    #[error("{message}")]
    ImportParse { message: String, line: usize },

    /// The only kind the frontend is allowed to surface as a generic toast.
    #[error("{0}")]
    Internal(String),
}

impl AppError {
    /// The serde tag the frontend switches on. Must match `ErrorKind` in types.ts.
    pub fn kind(&self) -> &'static str {
        match self {
            AppError::ConnectionRefused(_) => "connectionRefused",
            AppError::AuthFailed(_) => "authFailed",
            AppError::TlsError(_) => "tlsError",
            AppError::TunnelError(_) => "tunnelError",
            AppError::QueryError { .. } => "queryError",
            AppError::QueryCancelled(_) => "queryCancelled",
            AppError::ReadOnlyViolation(_) => "readOnlyViolation",
            AppError::NoPrimaryKey(_) => "noPrimaryKey",
            AppError::AmbiguousRowIdentity { .. } => "ambiguousRowIdentity",
            AppError::ConfirmationRequired { .. } => "confirmationRequired",
            AppError::SecretNotFound(_) => "secretNotFound",
            AppError::KeychainUnavailable(_) => "keychainUnavailable",
            AppError::VaultLocked(_) => "vaultLocked",
            AppError::ConfigIo(_) => "configIo",
            AppError::ConfigParse(_) => "configParse",
            AppError::GitNotInstalled(_) => "gitNotInstalled",
            AppError::GitConflict(_) => "gitConflict",
            AppError::GitDirty(_) => "gitDirty",
            AppError::ImportParse { .. } => "importParse",
            AppError::Internal(_) => "internal",
        }
    }

    pub fn detail(&self) -> Option<Value> {
        match self {
            AppError::QueryError { detail, .. } => detail.clone(),
            AppError::ConfirmationRequired { detail } => Some(detail.clone()),
            AppError::AmbiguousRowIdentity { index, .. } => {
                Some(serde_json::json!({ "index": index }))
            }
            AppError::ImportParse { line, .. } => Some(serde_json::json!({ "line": line })),
            _ => None,
        }
    }

    /// Convenience for wrapping any unexpected error as `internal`.
    pub fn internal(e: impl std::fmt::Display) -> Self {
        AppError::Internal(e.to_string())
    }
}

/// Wire shape sent to the frontend on any command failure.
#[derive(Serialize)]
struct ErrorResponse<'a> {
    kind: &'a str,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    detail: Option<Value>,
}

impl Serialize for AppError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        ErrorResponse {
            kind: self.kind(),
            message: self.to_string(),
            detail: self.detail(),
        }
        .serialize(serializer)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_simple_kind_without_detail() {
        let err = AppError::ConnectionRefused("host down".into());
        let v = serde_json::to_value(&err).unwrap();
        assert_eq!(v["kind"], "connectionRefused");
        assert_eq!(v["message"], "host down");
        assert!(
            v.get("detail").is_none(),
            "detail should be omitted when None"
        );
    }

    #[test]
    fn import_parse_carries_line_detail() {
        let err = AppError::ImportParse {
            message: "bad number".into(),
            line: 42,
        };
        let v = serde_json::to_value(&err).unwrap();
        assert_eq!(v["kind"], "importParse");
        assert_eq!(v["detail"]["line"], 42);
    }

    #[test]
    fn query_error_passes_through_detail() {
        let err = AppError::QueryError {
            message: "syntax error".into(),
            detail: Some(serde_json::json!({ "code": "42601", "position": 8 })),
        };
        let v = serde_json::to_value(&err).unwrap();
        assert_eq!(v["kind"], "queryError");
        assert_eq!(v["detail"]["position"], 8);
    }
}
