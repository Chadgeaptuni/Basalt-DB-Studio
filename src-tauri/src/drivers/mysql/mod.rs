//! MySQL / MariaDB engine specifics. `values.rs` and `ddl.rs` join later; this
//! M1 slice needs introspection only.

mod introspect;
mod values;

pub use introspect::{describe_table, introspect};
pub use values::{columns, decode_row};
