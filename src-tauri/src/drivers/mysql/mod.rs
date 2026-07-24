//! MySQL / MariaDB engine specifics. `values.rs` and `ddl.rs` join later; this
//! M1 slice needs introspection only.

mod introspect;

pub use introspect::{describe_table, introspect};
