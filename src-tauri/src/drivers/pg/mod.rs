//! Postgres engine specifics. `values.rs` (cell decode) and `ddl.rs` join this
//! module in later milestones; introspection is all this M1 slice needs.

mod introspect;

pub use introspect::{describe_table, introspect};
