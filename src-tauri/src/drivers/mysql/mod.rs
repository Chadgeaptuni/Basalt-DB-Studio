//! MySQL / MariaDB engine specifics. `values.rs` and `ddl.rs` join later; this
//! M1 slice needs introspection only.

mod introspect;
mod values;

pub use introspect::{describe_table, introspect};
pub use values::{bind_cell, columns, decode_row};
