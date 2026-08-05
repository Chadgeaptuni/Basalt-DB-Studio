# Basalt DB Studio — Codebase Walkthrough

**Audience:** an experienced TypeScript / Java developer who has never written Rust
or Svelte. **Budget:** ~2 hours, front to back, with the repo open in a second
window.

Every code sample below is real code from this repo, cited as `file:line`. Nothing
here is invented for teaching purposes — if a sample looks odd, that's the actual
code and the oddness is the lesson.

---

## How to spend the two hours

| Part | What | Minutes |
|---|---|---|
| 0 | Orientation — what the app is, how it's split | 10 |
| 1 | Health check — is this codebase clean? | 15 |
| 2 | Rust for a Java/TS head | 35 |
| 3 | Svelte 5 for a TS head | 30 |
| 4 | One feature, end to end: "run a query" | 20 |
| 5 | Reading order + exercises | 10 |

Parts 2 and 3 are the language teaching. Part 4 is where it clicks — it walks a
single button click through eleven files in both languages. If you're short on
time, read 0, then 4, then come back for 2 and 3.

---

# Part 0 — Orientation (10 min)

## What the app is

A desktop database GUI for PostgreSQL, MySQL, and SQLite. Think DBeaver, but
lightweight and keyboard-driven. It has a hard constraint of a **30 MB installed
bundle**, which explains a surprising number of the design decisions you'll see —
hand-rolled virtual scrolling instead of a grid library, enum dispatch instead of
trait objects, no state-management library.

## The two halves

```
Basalt-DB-Studio/
├── src/            ← frontend: Svelte 5 + TypeScript + Tailwind v4   (~7,500 lines)
├── src-tauri/      ← backend:  Rust + sqlx + Tauri 2                 (~6,100 lines)
└── docs/           ← specs
```

This is a **Tauri** app. Mentally, it's Electron with the Node process replaced by
a Rust process, and the bundled Chromium replaced by the OS's own webview. The
frontend is a normal web app — the same HTML/CSS/JS you already know — but instead
of `fetch()` to a server, it calls into local Rust functions over an IPC bridge.

That IPC bridge is the single most important concept in the codebase:

```
Svelte component
   → src/lib/api/*.ts          (typed wrapper, the ONLY place invoke() is called)
      → invoke("run_query")    IPC boundary — JSON over a message channel
         → #[tauri::command]   src-tauri/src/commands/*.rs
            → services/        business logic
               → drivers/      the actual database
```

Dependencies point one way. Nothing below `services/` knows Tauri exists — you
could lift `sqlgen/` out and use it in a CLI tomorrow.

## The backend, module by module

| Path | Job |
|---|---|
| `commands/` | Thin `#[tauri::command]` handlers. Deserialize → call service → return. **No logic.** |
| `services/` | Business logic. Session registry, query gates, grid edit → SQL, DDL generation. |
| `drivers/` | `enum Driver { Postgres \| MySql \| Sqlite }`. One match site per engine difference. |
| `drivers/types.rs` | The wire types, mirrored field-for-field in `src/lib/api/types.ts`. |
| `sqlgen/` | Pure SQL text utilities: statement splitting, classification, identifier quoting. No DB, no Tauri. Heavily tested. |
| `config/` | TOML profiles and saved queries on disk. |
| `errors/` | The one `AppError` enum. |

## The frontend, folder by folder

| Path | Job |
|---|---|
| `lib/api/` | Typed `invoke()` wrappers. **The only place `invoke` appears.** |
| `lib/stores/*.svelte.ts` | Global reactive state. No Redux, no Pinia — just runes in a module. |
| `lib/components/ui/` | Dumb reusable primitives. Button, Modal, VirtualList. **No business logic allowed.** |
| `lib/components/[domain]/` | Smart containers that wire stores + api + ui together. |
| `lib/utils/` | Keyboard registry, cell formatting, debounce, clipboard. |

The `ui/` vs `[domain]/` split is enforced by convention and code review, not by
tooling. It holds so far.

---

# Part 1 — Health check (15 min)

Before learning from a codebase, establish whether it's worth learning *from*.

## The mechanical checks

Both gates are build-blocking, and both currently pass clean:

```bash
cd src-tauri && cargo clippy --all-targets -- -D warnings
# → clean, zero warnings

pnpm check                    # svelte-check + vitest
# → clean, 66 tests / 21 files pass
```

`-D warnings` means "treat every lint as an error." Clippy is Rust's linter and it
is *opinionated* — it complains about things ESLint wouldn't dream of, like
"you wrote a manual loop where `.iter().map()` reads better." Passing it clean at
6,000 lines is a real signal.

## Size distribution

Largest Rust file: 404 lines. Largest frontend file: 357. Median well under 150.
The repo rule is "split as a file approaches 300 lines," and it's actually being
followed. There are no god objects and no grab-bag `utils.ts`.

## Verdict: clean, unusually so

Four things stand out as genuinely above-average:

**1. Errors are typed all the way across the IPC boundary.**

`src-tauri/src/errors/mod.rs` holds one enum with 20 variants. Each maps to a
stable string:

```rust
pub fn kind(&self) -> &'static str {
    match self {
        AppError::ConnectionRefused(_)       => "connectionRefused",
        AppError::AmbiguousRowIdentity { .. } => "ambiguousRowIdentity",
        // ...18 more
    }
}
```
`errors/mod.rs:89`

The frontend switches on `kind`, never on `message`:

```ts
if (err.kind === "confirmationRequired") { ... }
```
`EditorPane.svelte:78`

Most apps degrade into `catch (e) { toast("Something went wrong") }` by month
three. Here a new failure mode is *required* to be a new enum variant plus a new
member of the `ErrorKind` union in `types.ts`. The compiler enforces half of it;
the discipline covers the rest.

**2. The injection surface is one file, 52 lines.**

`sqlgen/quote.rs` is the only place an identifier becomes SQL text. Grid edits,
DDL generation, CSV import — every path routes through it:

```rust
pub fn quote_ident(engine: Engine, ident: &str) -> String {
    match engine {
        Engine::MySql => format!("`{}`", ident.replace('`', "``")),
        Engine::Postgres | Engine::Sqlite => format!("\"{}\"", ident.replace('"', "\"\"")),
    }
}
```
`sqlgen/quote.rs:9`

Small, tested, one responsibility. When someone eventually asks "are we safe
against a table named `"; DROP TABLE users; --`?", the answer is a 52-line file
you can read in a minute, not an audit.

**3. Comments explain *why*, never *what*.**

```rust
//! Cloning a `Driver` clones the underlying sqlx pool handle (an `Arc`), which
//! lets a caller lift the driver out of the session registry under a short lock
//! and then await the database without holding it.
```
`drivers/mod.rs:4`

That note prevents a deadlock. It is not `// this clones the driver`. Nearly every
comment in this repo is of the first kind. Learn from this.

**4. Tests are real, not decorative.**

`query_service.rs:95` creates an actual SQLite file on disk, seeds it, then proves
the destructive-statement gate fires:

```rust
#[tokio::test]
async fn destructive_statement_needs_confirmation() {
    let (sid, reg) = sqlite_session(false).await;
    let err = run(&sid, "DROP TABLE t", None, false, None, &reg).await.unwrap_err();
    assert_eq!(err.kind(), "confirmationRequired");
    // With confirmed=true it proceeds (and succeeds).
    run(&sid, "DROP TABLE t", None, true, None, &reg).await.unwrap();
}
```

Note the second half. It doesn't just assert the gate blocks — it asserts the
bypass works. That's the assertion people forget.

## What's rough

Five items, none urgent, all worth knowing about. These are also good teaching
examples, so they recur later in this doc.

**a) One handler per shortcut, globally.**

```ts
const registry = new Map<string, ShortcutHandler>();
```
`utils/keyboard.ts:49`

A `Map` keyed by combo means registering `mod+s` twice silently evicts the first
handler — and the first never comes back when the second unmounts. No collisions
exist today. It's a landmine for whoever adds the next modal. Fix would be
`Map<string, Set<handler>>`, or a stack with last-wins semantics.

**b) `preventDefault()` fires regardless of focus.**

```ts
function onKeydown(e: KeyboardEvent): void {
  const handler = registry.get(fromEvent(e));
  if (handler) {
    e.preventDefault();
    handler(e);
  }
}
```
`utils/keyboard.ts:52`

If anyone ever registers a bare key — `enter`, `delete` — typing into every input
in the app breaks at once. `DataGrid.svelte:89` sidesteps the registry entirely
for arrows/Enter/Delete, using a local handler on the `role="grid"` container.
That's the correct workaround, but it means `shortcuts.ts:3`'s claim to be "the one
catalogue" overstates: its DATA GRID group lists combos that are not in the
registry at all.

**c) Deprecated platform detection.**

```ts
const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform);
```
`utils/keyboard.ts:9`

`navigator.platform` is deprecated. Fine in today's Tauri webview; will rot.

**d) `$effect` used as a mount hook.**

```svelte
$effect(() => {
  void connections.load();
});
```
`StartPanel.svelte:21`

This is safe *here*, for a subtle reason covered in Part 3: `load()` writes
`profiles`/`loaded` only after an `await`, so those writes aren't tracked as
dependencies and the effect doesn't re-trigger itself. Add one synchronous
reactive read to `load()` and it becomes an infinite loop. It also double-fetches
with `ConnectionList` on startup. Works, but fragile.

**e) Passwords live in a plain in-memory Map.**

```ts
// Per-connection passwords, in memory only. A plain Map (not `$state`) on
// purpose: secrets must never become observable/serializable UI state.
const secrets = new Map<string, string>();
```
`stores/connections.svelte.ts:20`

The OS-keychain backend isn't built yet (`Cargo.toml:56` says as much). This is a
documented interim, not a lie — and note the deliberate choice *not* to use
`$state`, so secrets can never end up in a devtools reactive-state dump. Good
instinct.

---

# Part 2 — Rust for a Java/TS head (35 min)

Rust will feel familiar for about ten minutes and then hit you with one genuinely
new idea. Get that idea and the rest is vocabulary.

## 2.1 Ownership — the one genuinely new idea

Java and TypeScript both have a garbage collector. C has manual `malloc`/`free`.
Rust has **neither**. Instead:

> Every value has exactly one owner. When the owner goes out of scope, the value
> is freed. The compiler proves this statically.

No GC pauses, no runtime, no leaks, and — this is the part people underrate — no
data races, for free.

```rust
let s = String::from("hi");
let t = s;              // ownership MOVED to t
println!("{}", s);      // ❌ compile error: value borrowed after move
```

In Java, both variables would reference one object. In Rust, `s` is *dead* after
the move. This is the error you'll hit most in week one.

To use a value without taking it, you **borrow** with `&`:

```rust
pub fn quote_ident(engine: Engine, ident: &str) -> String {
```
`sqlgen/quote.rs:9`

Read the signature: "takes an `Engine` by copy, *borrows* some text, returns an
owned `String`." The caller keeps its string; the function returns a fresh one.

### The borrow rules

Two references, two rules, and they're the whole game:

| Form | Meaning | How many |
|---|---|---|
| `&T` | shared / read-only reference | any number at once |
| `&mut T` | exclusive / mutable reference | exactly one, and no `&T` at the same time |

"Many readers XOR one writer." Enforced at compile time. That single rule is why
Rust has no data races — you cannot hand two threads a mutable reference to the
same value, because the compiler won't produce the second reference.

### Owned / borrowed pairs

This pattern repeats through the whole standard library:

| Owned | Borrowed | Java-ish analogue |
|---|---|---|
| `String` | `&str` | `String` / a view into it |
| `Vec<T>` | `&[T]` | `ArrayList<T>` / a sublist view |
| `PathBuf` | `&Path` | `Path` / a view |

From this repo:

```rust
pub async fn run(&self, statements: &[Statement], limit: usize)
    -> AppResult<Vec<StatementResult>>
```
`drivers/mod.rs:61`

"Borrow myself, borrow the caller's list of statements, take a `usize` by copy,
return an owned vector of results." Nothing is copied to make this call. The
`statements` slice points at the caller's memory and the compiler guarantees the
caller doesn't free it mid-call.

### Lifetimes, briefly

Occasionally you'll see `'a` in a type:

```rust
struct ErrorResponse<'a> {
    kind: &'a str,
    message: String,
    detail: Option<Value>,
}
```
`errors/mod.rs:134`

`'a` is a **lifetime parameter**: "this struct holds a borrowed string, and the
struct may not outlive whatever it borrowed from." It's the compiler asking you to
name the relationship so it can check it. You mostly won't write these — the
compiler infers them — until you store a reference inside a struct, as here.

`&'static str` (seen at `errors/mod.rs:89`) means "borrowed for the entire program
lifetime" — in practice, a string literal baked into the binary.

## 2.2 No null — `Option<T>`

```rust
pub secret_ref: Option<String>,
```
`config/connections.rs:38`

`Option<T>` is either `Some(value)` or `None`. Same *shape* as TS's
`string | undefined`, with one enormous difference: **the compiler forces you to
handle `None` before you can touch the value.** There is no escape hatch that
quietly NPEs. Rust famously has no null at all.

Common idioms:

```rust
limit.unwrap_or(DEFAULT_ROW_LIMIT)      // Java's Optional.orElse
```
`query_service.rs:73`

```rust
if let Some(pw) = password {
    options = options.password(pw);
}
```
`connection_service.rs:220`

`if let` is "match this one pattern, ignore the rest" — the ergonomic form of a
one-armed `match`. You'll use it constantly.

```rust
text.lines().next().unwrap_or(text).trim()
```
`query_service.rs:84`

"First line, or the whole text if there are no lines, trimmed."

## 2.3 No exceptions — `Result<T, E>` and `?`

Rust has no `throw`. Fallible functions **return** their errors:

```rust
pub type AppResult<T> = Result<T, AppError>;
```
`errors/mod.rs:11`

`Result<T, E>` is `Ok(value)` or `Err(error)`. It's an ordinary enum — nothing
magic, no stack unwinding, no hidden control flow.

The `?` operator makes this bearable. It means *"unwrap the `Ok`, or return the
`Err` from this function immediately."*

```rust
let (driver, read_only) = connection_service::session_driver(session_id, registry).await?;
```
`query_service.rs:28`

That one character is an early return on failure. Compare to Java's
`try { ... } catch (SQLException e) { throw e; }` — same semantics, no ceremony,
and crucially **you cannot silently swallow it**: ignoring a `Result` produces a
compiler warning, and there's no equivalent of an empty catch block that
type-checks by accident.

Errors convert on the way up. `.map_err()` is the adapter:

```rust
let mut conn = pool.acquire().await.map_err(AppError::internal)?;
```
`drivers/exec.rs:59`

"Get a connection; if sqlx fails, wrap its error as `AppError::Internal`, then
`?` it up." Compare `map_query_error` at `exec.rs:148`, which does the richer
version — digging the SQLSTATE code out of the database error so the frontend can
render something specific:

```rust
pub(super) fn map_query_error(e: sqlx::Error) -> AppError {
    match &e {
        sqlx::Error::Database(db) => AppError::QueryError {
            message: db.message().to_string(),
            detail: db.code().map(|code| serde_json::json!({ "code": code.to_string() })),
        },
        _ => AppError::QueryError { message: e.to_string(), detail: None },
    }
}
```

### Mental model

| Java / TS | Rust |
|---|---|
| `throw` / `throws` | return `Result<T, E>` |
| `try/catch` | `match` on the `Result`, or `?` |
| checked exception | `Result` (but enforced without the boilerplate) |
| `null` | `Option<T>` |
| `Optional<T>` | `Option<T>` |
| NPE at runtime | doesn't compile |

## 2.4 Enums carry data — this is the second big one

A Rust `enum` is not a Java enum. It's a **discriminated union** — Kotlin's sealed
classes, or TypeScript's tagged unions, with real memory layout and zero tagging
overhead.

```rust
pub enum Driver {
    Postgres(PgPool),
    MySql(MySqlPool),
    Sqlite(SqlitePool),
}
```
`drivers/mod.rs:30`

Each variant holds a *different type* of payload. In TypeScript you'd write:

```ts
type Driver =
  | { kind: "postgres"; pool: PgPool }
  | { kind: "mysql";    pool: MySqlPool }
  | { kind: "sqlite";   pool: SqlitePool };
```

Variants can also have named fields, which reads like a struct:

```rust
AmbiguousRowIdentity { message: String, index: usize },
```
`errors/mod.rs:47`

### `match` is exhaustive

```rust
match self {
    Driver::Postgres(pool) => pg::introspect(pool).await,
    Driver::MySql(pool)    => mysql::introspect(pool).await,
    Driver::Sqlite(pool)   => sqlite::introspect(pool).await,
}
```
`drivers/mod.rs:38`

Add a fourth engine and **every `match` in the codebase stops compiling** until
you handle it. That's not a nuisance, that's the feature: the compiler hands you
a to-do list of every place engine-specific behavior lives.

This is why `CLAUDE.md` mandates "enum dispatch, no `dyn` traits." The alternative
— `Box<dyn DatabaseDriver>` — would be closer to a Java interface with runtime
polymorphism, but it costs a vtable indirection, prevents the compiler from
proving exhaustiveness, and adds bundle weight. With three known engines that will
never be extended at runtime, the enum wins on every axis.

`match` also destructures, guards, and binds:

```rust
match type_name {
    "BOOL" => get(row.try_get::<bool, _>(i).map(CellValue::Bool), type_name),
    "INT2" => get(row.try_get::<i16, _>(i).map(|v| CellValue::Int(v as i64)), type_name),
    // ...
}
```
`drivers/pg/values.rs:38`

And it's an *expression* — it evaluates to a value, like a ternary. Most Rust
functions end in a `match` or an `if` with no `return` keyword: **the last
expression in a block is its value.** A trailing semicolon suppresses that, which
is a classic beginner trip-up.

## 2.5 `impl` blocks — where methods live

Rust separates data from behavior. The type declares fields; a separate `impl`
block declares methods.

```rust
pub struct AppState {
    pub sessions: SessionRegistry,
    pub paths: Paths,
}

impl AppState {
    pub fn new() -> AppResult<Self> {
        Ok(Self {
            sessions: Mutex::new(HashMap::new()),
            paths: Paths::resolve()?,
        })
    }
}
```
`state.rs:14`

`Self` is "the type this impl block is for." `new()` here takes no `self`, so it's
a static method — Rust has no constructors, just a convention that the
constructor-ish function is called `new`.

Methods that *do* take self come in three flavors, and the flavor is the API
contract:

| Receiver | Meaning | Java analogue |
|---|---|---|
| `&self` | read-only borrow | a getter |
| `&mut self` | exclusive mutable borrow | a setter |
| `self` | **consumes** the value; caller can't use it after | a builder's terminal `.build()` |

```rust
pub fn kind(&self) -> &'static str      // errors/mod.rs:89  — reads
pub async fn close(&self)               // drivers/mod.rs:173 — reads (pool close is interior-mutable)
```

## 2.6 Traits — interfaces, but more flexible

```rust
pub trait Affected {
    fn affected(&self) -> u64;
}

impl Affected for sqlx::postgres::PgQueryResult {
    fn affected(&self) -> u64 { self.rows_affected() }
}
```
`drivers/exec.rs:21`

A trait is an interface. The twist: **you can implement a trait for a type you
didn't define.** `PgQueryResult` belongs to sqlx; `Affected` belongs to this
codebase; the impl glues them together. In Java you'd need an adapter class.

The comment above it explains exactly why this exists:

> sqlx exposes no generic `rows_affected`, so a tiny `Affected` adapter bridges
> the three concrete `QueryResult` types.

Same trick for serialization:

```rust
impl Serialize for AppError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        ErrorResponse { kind: self.kind(), message: self.to_string(), detail: self.detail() }
            .serialize(serializer)
    }
}
```
`errors/mod.rs:141`

That's a hand-written impl because the wire shape differs from the enum shape.
Usually you don't write these — you derive them.

### Derive macros

```rust
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum Engine { Postgres, MySql, Sqlite }
```
`drivers/types.rs:15`

`#[derive(...)]` generates the trait impls at compile time. Think Lombok, except
built into the language, universally used, and not a hack. The common ones:

- `Debug` — printable with `{:?}`, for logs and test failures
- `Clone` — explicit deep-ish copy via `.clone()`. Rust never copies implicitly
- `Copy` — cheap bitwise copy; the type stops moving on assignment (only for small, simple types like `Engine`)
- `PartialEq, Eq` — `==` works
- `Serialize, Deserialize` — serde JSON/TOML support

Attributes configure the generated code:

```rust
#[serde(rename_all = "camelCase")]
pub struct SessionInfo {
    pub session_id: String,      // ← serializes as "sessionId"
    ...
}
```
`drivers/types.rs:69`

That single attribute is why Rust's `snake_case` fields line up with TypeScript's
`camelCase` in `src/lib/api/types.ts`. And:

```rust
#[serde(skip_serializing_if = "Option::is_none")]
pub detail: Option<Value>,
```
`errors/mod.rs:137`

`None` is omitted from the JSON entirely, so TypeScript's optional `detail?:`
matches exactly.

## 2.7 Generics and trait bounds

Generics look like Java's until you meet `where` clauses. This is the gnarliest
signature in the repo — worth decoding once, then you'll never be scared again:

```rust
pub async fn run_batch<DB, FC, FR>(
    pool: &sqlx::Pool<DB>,
    statements: &[Statement],
    limit: usize,
    columns_of: FC,
    decode: FR,
) -> AppResult<Vec<StatementResult>>
where
    DB: Database,
    DB::QueryResult: Affected,
    for<'c> &'c mut DB::Connection: Executor<'c, Database = DB>,
    DB::Arguments: IntoArguments<DB> + Default,
    FC: Fn(&DB::Row) -> Vec<ColumnInfo>,
    FR: Fn(&DB::Row) -> Vec<CellValue>,
```
`drivers/exec.rs:44`

Line by line:

- `<DB, FC, FR>` — three type parameters: the database, and two function types.
- `DB: Database` — `DB` must implement sqlx's `Database` trait. Java's `<DB extends Database>`.
- `DB::QueryResult: Affected` — an *associated type* on `DB` must implement our `Affected` trait. Java has no clean equivalent.
- `for<'c> &'c mut DB::Connection: Executor<'c, ...>` — a higher-ranked bound: "for *any* lifetime `'c`." You can safely read this as "a mutable connection reference can execute queries" and move on.
- `FC: Fn(&DB::Row) -> Vec<ColumnInfo>` — `FC` is any callable with that signature. Rust closures each have a unique anonymous type, so you constrain them by trait rather than naming a type.

And the payoff — the call site:

```rust
Driver::Postgres(pool) => exec::run_batch(pool, statements, limit, pg::columns, pg::decode_row).await,
Driver::MySql(pool)    => exec::run_batch(pool, statements, limit, mysql::columns, mysql::decode_row).await,
Driver::Sqlite(pool)   => exec::run_batch(pool, statements, limit, sqlite::columns, sqlite::decode_row).await,
```
`drivers/mod.rs:67`

**One batch loop, three engines, zero duplication, zero runtime cost.** The
generic is monomorphized — the compiler stamps out three specialized copies at
build time, each fully inlined. That's the "zero-cost abstraction" slogan in
practice, and it's why this repo can hand-roll things that would otherwise need a
dependency.

## 2.8 Async, `Arc`, `Mutex`

Rust's `async`/`await` looks like TypeScript's, with one critical difference:

> **Futures are lazy.** Calling an `async fn` does nothing. No work happens until
> you `.await` it.

In TS, `foo()` starts running immediately and `await` just waits for the promise.
In Rust, `foo()` builds a state machine and hands it to you, inert.

Rust also ships no event loop. **Tokio** is the runtime, and it's a normal
dependency. `#[tokio::test]` (seen throughout `query_service.rs`) spins one up for
a test.

### Shared state

```rust
pub struct AppState {
    pub sessions: SessionRegistry,   // = Mutex<HashMap<String, Session>>
    pub paths: Paths,
}
```
`state.rs:14`

Two types you'll meet constantly:

- **`Arc<T>`** — Atomically Reference-Counted pointer. Shared ownership: the value lives until the last `Arc` drops. Closest thing Rust has to a Java object reference.
- **`Mutex<T>`** — note it wraps **the data**, not a code block. In Java, `synchronized` guards a region and nothing stops you touching the field elsewhere. In Rust you cannot reach the `HashMap` without going through `.lock()`. The lock isn't a convention, it's structural.

And the subtlety the file header calls out:

```rust
//! the registry uses `tokio::sync::Mutex` so it may be held across `.await`.
```
`state.rs:4`

`std::sync::Mutex` blocks the OS thread. Holding one across an `.await` can
deadlock the async runtime, because the task may be parked while still holding it.
`tokio::sync::Mutex` yields instead. Knowing which to reach for is a real Rust
skill, and this codebase documented its choice at the top of the file.

Then compare `drivers/mod.rs:4`:

> Cloning a `Driver` clones the underlying sqlx pool handle (an `Arc`), which lets
> a caller lift the driver out of the session registry under a short lock and then
> await the database without holding it.

That's the *other* half of the strategy: take the lock, clone the cheap `Arc`
handle out, release the lock, then do the slow database work unlocked. Standard
technique, easy to get wrong, documented here.

## 2.9 Modules and visibility

```rust
mod exec;          // private: drivers/exec.rs, usable only inside drivers/
pub mod export;    // public
pub mod types;
mod mysql;
mod pg;
mod sqlite;
```
`drivers/mod.rs:9`

- `mod foo;` pulls in `foo.rs` **or** `foo/mod.rs`. No imports-by-path, no barrel files — the module tree is declared.
- **Everything is private by default.** `pub` exports. There's also `pub(super)` ("visible to my parent module") — see `map_query_error` at `exec.rs:148`, deliberately shared with `drivers/grid.rs` but not the wider crate.
- `use` brings names into scope (like an `import`).
- `crate::` is your package root: `use crate::sqlgen::Statement;`

Re-exports flatten the public surface:

```rust
pub use classify::{confirmation_reason, is_read_only, returns_rows, tx_effect, TxEffect};
pub use quote::{quote_ident, quote_qualified};
pub use split::{split, statement_at, Statement};
```
`sqlgen/mod.rs:17`

Callers write `sqlgen::split(...)` and never learn that `split.rs` exists.

## 2.10 Iterators

Rust's iterators are lazy, chainable, and compile down to a plain loop.

```rust
let flagged: Vec<_> = statements
    .iter()                                        // borrow each element
    .enumerate()                                   // → (index, item) pairs
    .filter_map(|(index, s)| {                     // filter + map in one pass
        sqlgen::confirmation_reason(&s.text)       // returns Option<&str>
            .map(|reason| json!({ "index": index, "statement": s.text, "reason": reason }))
    })
    .collect();                                    // build the Vec
```
`query_service.rs:57`

`filter_map` keeps only the `Some` results — the classic "map to Option, drop the
Nones" combinator that TS makes you fake with `.map().filter(Boolean)` and a cast.

`|x| ...` is closure syntax — `x => ...` in TS, `x -> ...` in Java.

`Vec<_>` means "a Vec of… you figure it out." The compiler infers the element type
from `collect()`. You'll see `_` all over.

```rust
if let Some(bad) = statements.iter().find(|s| !sqlgen::is_read_only(&s.text)) {
```
`query_service.rs:46`

"Find the first non-read-only statement; if there is one, bind it to `bad`."

## 2.11 The syntax you'll actually trip over

| Syntax | Meaning |
|---|---|
| `let x = 5;` | immutable binding. **Default.** |
| `let mut x = 5;` | mutable binding. You must opt in. |
| `&x` / `&mut x` | borrow / mutable borrow |
| `*x` | dereference |
| `&mut **conn` | deref twice, re-borrow. `PoolConnection` derefs to a connection (`exec.rs:106`) |
| `x?` | unwrap `Result`/`Option` or early-return the error |
| `x.unwrap()` | unwrap or **panic**. Fine in tests, a smell in production code |
| `foo::<T>(x)` | explicit type argument, the "turbofish". `row.try_get::<i16, _>(i)` |
| `impl Trait` | "some type implementing Trait", in an argument or return position |
| `'a`, `'static` | lifetimes |
| `#[...]` | attribute (annotation) |
| `//!` | module-level doc comment (documents the file it's at the top of) |
| `///` | doc comment for the next item |
| `{}` / `{:?}` | format placeholders: Display / Debug |
| `format!("{}", x)` | returns a String. `println!` prints it |

One that catches everyone: **no trailing semicolon means "this is the return
value."**

```rust
fn first_line(text: &str) -> &str {
    text.lines().next().unwrap_or(text).trim()      // ← no semicolon = returned
}
```
`query_service.rs:83`

Add a `;` there and the function returns `()` (unit, i.e. void) and fails to
compile.

---

# Part 3 — Svelte 5 for a TS head (30 min)

If you know React, Svelte 5 is React with the papercuts removed. If you don't,
it's simpler than React anyway.

**Critical warning:** Svelte 5 (2024) rewrote the reactivity model. Almost every
blog post, Stack Overflow answer, and LLM training set you'll hit describes Svelte
3/4 — `export let`, `$:`, `on:click`, stores with `$store`, slots. **All of that is
wrong here.** If a snippet has `on:click`, it's outdated. This repo is Svelte 5
throughout.

## 3.1 A component is one file

```svelte
<script lang="ts">
  let count = $state(0);
</script>

<button onclick={() => count++}>clicked {count}</button>

<style>
  button { color: red; }
</style>
```

That's it. No `export default`, no class, no `render()`. The compiler turns this
into JavaScript that manipulates the DOM directly — **there is no virtual DOM and
no diffing.** Svelte knows at compile time exactly which DOM node depends on
`count`, so an update is a targeted `textContent` write. Architecturally it's much
closer to SolidJS than to React.

`<style>` is automatically scoped to the component. This repo barely uses it —
Tailwind utility classes do the work.

## 3.2 Runes — reactivity with a `$` prefix

Runes are compiler-recognized functions. They're signals, in the Solid/MobX sense.

### `$state` — reactive variable

```svelte
let sel = $state<{ r: number; c: number } | null>(null);
let editing = $state<{ r: number; c: number } | null>(null);
let draft = $state("");
```
`components/grid/DataGrid.svelte:58`

Compare React's `const [sel, setSel] = useState(null)`. Here there is **no setter**
— you reassign the variable and the compiler wires up the notification:

```ts
sel = { r, c };
```

### Deep reactivity via Proxy — the thing that surprises React devs

`$state` on an object or array wraps it in a Proxy, so **mutation works**:

```ts
tabs.push(base(id, `Query ${seq}`, "sql", null, sql));
```
`stores/tabs.svelte.ts:63`

```ts
tabs.splice(i, 1);
```
`stores/tabs.svelte.ts:112`

```ts
delete statuses[id];
```
`stores/connections.svelte.ts:54`

No `setTabs([...tabs, newTab])`. No immutability discipline. No `useReducer`. The
proxy notices the mutation and only the affected DOM updates. Nested properties
are reactive too, which is why `EditorPane.svelte:55` can write
`tab.result = result` and the results pane in a different component re-renders.

### `$derived` — computed value

```svelte
const total = $derived(items.length * rowHeight);
const start = $derived(Math.max(0, Math.floor(scrollTop / rowHeight) - overscan));
const end   = $derived(Math.min(items.length, start + visibleCount));
const slice = $derived(items.slice(start, end));
```
`components/ui/VirtualList.svelte:36`

React's `useMemo`, minus the dependency array — **and therefore minus the entire
category of bugs caused by getting the dependency array wrong.** Svelte tracks
which signals you read while evaluating, and recomputes only when one of those
changes. `$derived` values can depend on other `$derived` values, as `end` does on
`start`, and the graph sorts itself out.

For multi-statement computations there's `$derived.by(() => { ... })`.

### `$props` — component inputs

```svelte
interface Props {
  items: T[];
  rowHeight: number;
  overscan?: number;
  row: Snippet<[T, number]>;
  header?: Snippet;
  contentWidth?: number;
  class?: string;
}

let { items, rowHeight, overscan = 10, row, header, contentWidth, class: cls = "" }: Props = $props();
```
`components/ui/VirtualList.svelte:7`

Ordinary destructuring with ordinary defaults. Note `class: cls = ""` — `class` is
a reserved word in JS, so it gets renamed on the way in. That idiom appears in
nearly every `ui/` component here.

Note also `<script lang="ts" generics="T">` on line 1 — that's how a Svelte
component takes a **generic type parameter**. `VirtualList` is fully typed over
whatever it renders.

### `$effect` — side effects

```svelte
$effect(() => {
  if (!viewport) return;
  clientHeight = viewport.clientHeight;
  const ro = new ResizeObserver(() => {
    if (viewport) clientHeight = viewport.clientHeight;
  });
  ro.observe(viewport);
  return () => ro.disconnect();      // ← cleanup
});
```
`components/ui/VirtualList.svelte:47`

React's `useEffect` with three differences:
1. **No dependency array.** It tracks whatever reactive values you read inside.
2. Returning a function registers cleanup (same as React).
3. It runs *after* the DOM updates, and re-runs when a tracked dependency changes.

The prettiest use of it in this repo:

```svelte
$effect(() => keyboard.register("mod+t", () => editorTabs.open()));
```
`components/workspace/Workspace.svelte:26`

`keyboard.register` returns its own unsubscribe function (`keyboard.ts:68`). The
arrow function returns it implicitly. So the effect's return value *is* the
cleanup. One line, registered on mount, unregistered on unmount, no leak.

**The gotcha (this was finding (d) in Part 1):**

```svelte
$effect(() => {
  void connections.load();
});
```
`components/layout/StartPanel.svelte:21`

Used as a mount hook. Why doesn't it loop forever, given `load()` writes
`profiles` and `loaded`, which are `$state`?

Because dependency tracking is **synchronous**. Svelte records reads that happen
during the effect's synchronous execution. `load()` hits `await connectionsApi.list()`
immediately; everything after that await runs in a later microtask, outside the
tracking window. So the writes aren't dependencies and nothing re-triggers.

Correct today, fragile forever. One synchronous reactive read added to `load()` —
say an early `if (loaded) return;` — turns it into an infinite loop. If you ever
touch this file, this is the sentence to remember.

### Rune quick reference

| Rune | Purpose | React analogue |
|---|---|---|
| `$state(v)` | reactive variable, deep via Proxy | `useState` (no setter) |
| `$derived(expr)` | computed | `useMemo` (no dep array) |
| `$derived.by(() => {...})` | computed, multi-statement | `useMemo` |
| `$props()` | component inputs | function props |
| `$effect(() => {...})` | side effect + cleanup | `useEffect` (no dep array) |
| `$effect.pre` | runs before DOM update | `useLayoutEffect` |
| `$inspect(v)` | dev-only logging on change | — |

## 3.3 Global state = a `.svelte.ts` module (and the getter gotcha)

No Redux. No Pinia. No context providers. Any file named `*.svelte.ts` may use
runes, and that's the whole state layer.

But there's a rule that shapes every store in this repo:

> **You cannot export a reassigned `let`.** It's a compile error.

Why: a plain `export let profiles` would give the importer a *snapshot* of the
value at import time, not a live connection to the signal. JS module bindings
can't carry reactivity. So Svelte forbids it, and the workaround is a getter:

```ts
let profiles = $state<ConnectionProfile[]>([]);
let loaded = $state(false);
let loadError = $state<ApiError | null>(null);

async function load(): Promise<void> {
  try {
    profiles = await connectionsApi.list();
    loadError = null;
    loaded = true;
  } catch (e) {
    loadError = e as ApiError;
    loaded = true;
  }
}

export const connections = {
  get profiles() { return profiles; },
  get loaded()   { return loaded; },
  get loadError(){ return loadError; },
  statusFor, load, save, remove, setSecret, connect, disconnect, setActive,
};
```
`stores/connections.svelte.ts` (abridged)

When a component reads `connections.profiles` during render, the getter runs *at
that moment*, inside the tracking window, and the dependency registers. That's why
every store in this codebase looks like this. It is not ceremony — it's
load-bearing.

`stores/tabs.svelte.ts:120` follows the identical shape. Once you've seen two,
you've seen all of them.

Note also the deliberate exception at `connections.svelte.ts:24`: the password
`Map` is *not* `$state`, precisely so it never becomes observable reactive state.

## 3.4 Markup

```svelte
{#if !connections.loaded}
  <Spinner size="sm" /> Loading…
{:else if connections.loadError}
  <div class="text-danger">Couldn't read your saved connections.</div>
{:else if connections.profiles.length > 0}
  <ul>
    {#each connections.profiles as p (p.id)}
      <li><ConnectionRow profile={p} onclick={() => open(p)} /></li>
    {/each}
  </ul>
{/if}
```
`components/layout/StartPanel.svelte:42` (abridged)

- `{#if}` / `{:else if}` / `{:else}` / `{/if}`
- `{#each list as item (key)}` — the parenthesized part is the **key**, same purpose as React's `key` prop. Always provide it for lists that reorder.
- `{#each list as item, i (key)}` — with index.
- `{@const x = ...}` — a local binding inside a block. `DataGrid.svelte:150` uses it for `selected` and `dirty`.
- `{#await promise}` exists too, though this repo prefers explicit loading state.

Notice the three-state rendering in that snippet — loading, error, empty/data.
`DESIGN.md` mandates all three for every view, and the error branch says
*"Couldn't read your saved connections"* with a retry button, not "Something went
wrong."

### Events are plain props

```svelte
<button onclick={() => count++}>
```

`onclick`, not `on:click`. There are no event modifiers (`|preventDefault` is
gone) — you call `e.preventDefault()` yourself. And when you pass `onclick` to a
*component* rather than an element, it's just a callback prop:

```svelte
<ConnectionRow profile={p} onclick={() => open(p)} />
```

No `createEventDispatcher`, no event bubbling ceremony. The child declares
`onclick` in its `Props` interface and calls it. This is why the codebase has no
event-dispatch layer at all.

### `bind:` — two-way binding

```svelte
<div bind:this={viewport}>          <!-- element reference, like useRef -->
<input bind:value={draft} />        <!-- two-way binding to a $state var -->
```
`VirtualList.svelte:58`, `DataGrid.svelte:170`

`bind:value` is genuine two-way binding — typing updates `draft` with no
`onChange` handler. Convenient, and occasionally too clever; use it for form
inputs and little else.

### `use:` — actions

```svelte
<input use:focusSelect ... />
```
`DataGrid.svelte:169`

```ts
function focusSelect(node: HTMLInputElement): void {
  node.focus();
  node.select();
}
```
`DataGrid.svelte:67`

An **action** is a function that receives the DOM node when it mounts. It's the
idiomatic escape hatch for imperative DOM work — focus management, third-party
library initialization, drag handlers. It can return `{ update, destroy }` for
lifecycle. Here it's three lines that focus and select an input the moment a cell
enters edit mode.

## 3.5 Snippets replaced slots

Slots are gone. **Snippets** are reusable markup chunks — typed render props, with
parameters.

Declared as a prop:

```svelte
row: Snippet<[T, number]>;      // takes an item and an index
header?: Snippet;               // takes nothing
```
`VirtualList.svelte:11`

Invoked with `{@render}`:

```svelte
{#if header}
  <div class="sticky top-0 z-10">{@render header()}</div>
{/if}
...
{#each slice as item, i (start + i)}
  {@render row(item, start + i)}
{/each}
```
`VirtualList.svelte:59`

Supplied by the caller:

```svelte
<VirtualList items={display} rowHeight={ROW_H} contentWidth={width} class="h-full">
  {#snippet header()}
    <div class="flex bg-grid-header-bg">…column headers…</div>
  {/snippet}
  {#snippet row(cells, r)}
    <div class="flex {rowBg(r)}">…cells…</div>
  {/snippet}
</VirtualList>
```
`DataGrid.svelte:131`

This is the composition mechanism to internalize. `VirtualList` knows *nothing*
about grids, columns, or cells — it only knows how to window a list and call your
snippet with `(item, index)`. `DataGrid` supplies the appearance. The types check
end to end because `Snippet<[T, number]>` is a real generic type.

A snippet passed as the default child is available as the `children` prop, which
is how `Button.svelte` and friends work.

## 3.6 Tailwind v4 note

Styling is Tailwind v4, which is **CSS-first**: there is no `tailwind.config.js`,
no PostCSS setup, no `content` array. Design tokens are declared with `@theme` in
CSS, and themes are `[data-theme]` variable blocks in `src/themes/`.

That's why you see semantic class names like `text-fg-2`, `bg-bg-0`,
`border-border`, `bg-grid-row-alt` rather than `text-gray-400`. Those are tokens,
and they're what makes the theme picker work. `DESIGN.md` bans raw color literals
outright.

---

# Part 4 — One feature, end to end (20 min)

This is the section that makes the codebase click. Follow a single user action —
pressing **Run** on a `DROP TABLE` statement — through eleven files, both
languages, and the IPC boundary.

## Step 1 — The click (Svelte)

```svelte
<Button variant="primary" size="sm" disabled={!canRun} loading={tab?.running}
        onclick={() => tab && handleRun({ sql: tab.sql })}>
  <Play size={13} strokeWidth={2} /> Run
</Button>
```
`components/editor/EditorPane.svelte:120`

`canRun` is derived, so the button's disabled state maintains itself:

```svelte
const tab    = $derived(editorTabs.active);
const sess   = $derived(connections.active);
const canRun = $derived(Boolean(sess) && Boolean(tab) && !tab?.running);
```
`EditorPane.svelte:22`

Three signals, and any change to the active tab, active session, or running flag
re-evaluates the chain automatically.

## Step 2 — Orchestration (Svelte)

```ts
async function handleRun(payload: { sql: string; cursorOffset?: number }): Promise<void> {
  if (!tab || !sess || !payload.sql.trim()) return;
  tab.running = true;                    // ← mutation; the button re-renders
  tab.runError = null;
  tab.runStartedAt = Date.now();
  try {
    await runOnce(payload, false);       // confirmed = false
  } catch (e) {
    const err = e as ApiError;
    if (err.kind === "confirmationRequired") {
      if (await confirmDestructive(err)) {
        try { await runOnce(payload, true); }   // re-run, confirmed = true
        catch (e2) { tab.runError = e2 as ApiError; }
      }
    } else {
      tab.runError = err;
      if (err.kind === "internal") toast.error(err.message);
    }
  } finally {
    tab.running = false;
    tab.runStartedAt = null;
  }
}
```
`EditorPane.svelte:69`

Note `tab.running = true` — a mutation on a nested property of a `$state` object,
picked up by the proxy. The Run button's `loading` prop flips with no plumbing.

Note also the error handling: it branches on `err.kind`, a typed union. Only
`internal` is allowed to become a generic toast.

## Step 3 — The API wrapper (TypeScript)

```ts
export const queryApi = {
  run: (sessionId: string, sql: string,
        opts: { cursorOffset?: number; confirmed?: boolean; limit?: number } = {}) =>
    invoke<RunResult>("run_query", {
      sessionId, sql,
      cursorOffset: opts.cursorOffset,
      confirmed: opts.confirmed ?? false,
      limit: opts.limit,
    }),
};
```
`lib/api/query.ts:8`

The only `invoke` site for this domain. `"run_query"` is the command name — a
string, and this string plus the argument names are the actual contract with Rust.
Get either wrong and you find out at runtime, not compile time. That's precisely
why every `invoke` is confined to `src/lib/api/`: the unchecked surface is small
and reviewable.

## Step 4 — The IPC error normalizer (TypeScript)

```ts
export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await tauriInvoke<T>(cmd, args);
  } catch (raw) {
    if (isErrorResponse(raw)) throw new ApiError(raw);
    throw new ApiError({ kind: "internal", message: String(raw) });
  }
}
```
`lib/api/client.ts:36`

Every failure that crosses the boundary becomes an `ApiError` with a typed `.kind`.
Even a Rust panic or a serialization fault gets normalized to `internal`, so
callers can rely on `catch (e)` always yielding an `ApiError`. That guarantee is
what makes `EditorPane`'s `err.kind ===` checks safe.

**→ IPC boundary. JSON serialized, sent to the Rust process. →**

## Step 5 — Command registration (Rust)

```rust
.invoke_handler(tauri::generate_handler![
    commands::query::run_query,
    commands::grid::grid_browse,
    // ...22 more
])
```
`lib.rs:38`

A macro that generates the dispatch table. The function name becomes the command
string — `run_query` in Rust is `"run_query"` from TS.

## Step 6 — The command handler (Rust)

```rust
#[tauri::command]
pub async fn run_query(
    session_id: String,
    sql: String,
    cursor_offset: Option<usize>,
    confirmed: bool,
    limit: Option<usize>,
    state: State<'_, AppState>,
) -> AppResult<RunResult> {
    query_service::run(&session_id, &sql, cursor_offset, confirmed, limit, &state.sessions).await
}
```
`commands/query.rs:13`

The whole file is 31 lines including comments. That's the rule — commands
deserialize, delegate, return.

Three things worth noticing:

- Tauri maps JS `camelCase` args to Rust `snake_case` params automatically. `cursorOffset` → `cursor_offset`.
- `Option<usize>` means the argument may be absent. TS `cursorOffset?: number` lines up exactly.
- `State<'_, AppState>` is dependency injection — Tauri hands you the value registered by `app.manage(AppState::new()?)` at `lib.rs:34`. The `'_` is an elided lifetime.
- `&session_id` / `&sql` — the handler *owns* those Strings, and lends them to the service rather than moving them.

## Step 7 — The service: split, then gate (Rust)

```rust
let (driver, read_only) = connection_service::session_driver(session_id, registry).await?;

let statements = match cursor_offset {
    Some(offset) => sqlgen::statement_at(sql, offset).into_iter().collect(),
    None => sqlgen::split(sql),
};
if statements.is_empty() {
    return Ok(RunResult { statements: Vec::new(), tx_status: TxStatus::Idle });
}
```
`services/query_service.rs:28`

`session_driver` takes the registry lock, clones the `Arc` pool handle out, and
releases — the pattern documented at `drivers/mod.rs:4`.

Then the **read-only gate**:

```rust
if read_only {
    if let Some(bad) = statements.iter().find(|s| !sqlgen::is_read_only(&s.text)) {
        return Err(AppError::ReadOnlyViolation(format!(
            "connection is read-only; refused: {}", first_line(&bad.text)
        )));
    }
}
```
`query_service.rs:45`

The whole run is rejected, so nothing partial executes. Note the error message
names the offending statement — actionable, not "operation not permitted."

Then the **confirmation gate** — our `DROP TABLE` trips this:

```rust
if !confirmed {
    let flagged: Vec<_> = statements.iter().enumerate()
        .filter_map(|(index, s)| {
            sqlgen::confirmation_reason(&s.text)
                .map(|reason| json!({ "index": index, "statement": s.text, "reason": reason }))
        })
        .collect();
    if !flagged.is_empty() {
        return Err(AppError::ConfirmationRequired { detail: json!({ "statements": flagged }) });
    }
}
```
`query_service.rs:56`

**The gates run in Rust, before anything touches the database.** They are not UI
suggestions — a compromised or buggy frontend cannot bypass them.

## Step 8 — Splitting is a real parser (Rust)

`sqlgen::split` is not `sql.split(';')`. It's a byte-level state machine:

```rust
//! Multi-statement splitting. A byte-level state machine finds top-level `;`
//! while ignoring semicolons inside string/identifier literals, `--` line and
//! `/* */` block comments, and Postgres `$tag$` dollar-quoted bodies. All
//! delimiter chars are ASCII, and multi-byte UTF-8 bytes are all ≥ 0x80, so
//! byte scanning never splits a codepoint and every cut lands on a char boundary.
```
`sqlgen/split.rs:1`

That last sentence is a correctness proof for why byte-level scanning is safe on
UTF-8 input — exactly the kind of reasoning that belongs in a comment.

```rust
pub struct Statement {
    pub start: usize,
    pub end: usize,
    pub text: String,
}
```

`start..end` tiles the *entire* input — every statement absorbs the whitespace and
comments before it — so `statement_at(sql, cursor)` maps any cursor position to
exactly one statement with no gaps. That's how "run statement at cursor"
(`mod+enter`) works, and the tiling invariant is what makes it never fail.

## Step 9 — The error comes back (Rust → TypeScript)

`AppError::ConfirmationRequired` returns up through `?`, and Tauri serializes it
using the hand-written impl:

```rust
impl Serialize for AppError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        ErrorResponse { kind: self.kind(), message: self.to_string(), detail: self.detail() }
            .serialize(serializer)
    }
}
```
`errors/mod.rs:141`

On the wire:

```json
{
  "kind": "confirmationRequired",
  "message": "confirmation required",
  "detail": { "statements": [ { "index": 0, "statement": "DROP TABLE t", "reason": "..." } ] }
}
```

`client.ts` recognizes the shape and throws an `ApiError`. `EditorPane.svelte:78`
catches it, matches `kind`, and renders the dialog:

```ts
const message = list.length === 1
  ? `${list[0].reason}\n\n${list[0].statement}`
  : `${list.length} destructive statements:\n\n${list.map((s) => `• ${s.reason}`).join("\n")}`;
return confirm({ title: "Run destructive statement?", message, confirmLabel: "Run", variant: "danger" });
```
`EditorPane.svelte:99`

The dialog shows the *actual SQL* that will run. That's what the `detail` payload
is for, and it's why `detail` is typed per-variant at `errors/mod.rs:114` rather
than being a free-form string.

## Step 10 — Confirmed re-run reaches the database (Rust)

User clicks Run. `runOnce(payload, true)` fires, both gates pass, and:

```rust
let results = driver.run(&statements, limit.unwrap_or(DEFAULT_ROW_LIMIT)).await?;
```
`query_service.rs:72`

Which lands in the generic batch loop from §2.7:

```rust
let mut conn = pool.acquire().await.map_err(AppError::internal)?;
let mut out = Vec::with_capacity(statements.len());
for stmt in statements {
    match run_one::<DB, _, _>(&mut conn, &stmt.text, limit, &columns_of, &decode).await {
        Ok(result) => out.push(result),
        Err(e) => {
            out.push(StatementResult { /* ...with error attached... */ });
            break;                          // stop at the first failure
        }
    }
}
```
`drivers/exec.rs:59`

One connection for the whole batch, so a `BEGIN`/`COMMIT` pair in a script shares
a transaction. Note the failure handling: the error is attached to *that
statement's* result and the loop breaks — so the UI can show "statements 1–3
succeeded, 4 failed with this message" rather than losing everything.

For row-returning statements, the limit stops the stream early rather than
fetching everything and slicing:

```rust
let mut stream = sqlx::query(AssertSqlSafe(text.to_owned())).fetch(&mut **conn);
while let Some(item) = stream.next().await {
    let row = item.map_err(map_query_error)?;
    if columns.is_empty() { columns = columns_of(&row); }
    if rows.len() < limit { rows.push(decode(&row)); }
    else { truncated = true; break; }
}
```
`drivers/exec.rs:106`

`AssertSqlSafe` is a sqlx 0.9 marker: "I know this is user-supplied SQL and I'm
asserting it's intentional." It's mandatory for dynamic SQL, and it's the reason
this app can exist at all — it's a SQL client, so running arbitrary user text *is*
the product. The safety story lives elsewhere: the read-only gate, the
confirmation gate, and `quote_ident` for anything the app itself generates.

## Step 11 — Decode, then back to the UI

Each row is decoded per-engine, driven by the column's SQL type name:

```rust
fn decode_cell(row: &PgRow, i: usize, type_name: &str) -> CellValue {
    if matches!(row.try_get_raw(i), Ok(v) if v.is_null()) { return CellValue::Null; }
    match type_name {
        "BOOL" => get(row.try_get::<bool, _>(i).map(CellValue::Bool), type_name),
        "INT2" => get(row.try_get::<i16, _>(i).map(|v| CellValue::Int(v as i64)), type_name),
        // ...
    }
}
```
`drivers/pg/values.rs:34`

`values.rs` is the single place engine types map to and from `CellValue`, per
engine. Postgres `NUMERIC` keeps full precision as a string (never an f64 —
that would silently corrupt money); timestamps preserve their offset; anything
unmatched degrades to `Unknown` rather than guessing.

`RunResult` serializes back, and:

```ts
tab.result = result;
tab.activeStatement = 0;
```
`EditorPane.svelte:55`

Two mutations on the `$state` tab object. `ResultsPane` and `DataGrid` are reading
`tab.result` through derived values, so the grid renders. No subscription, no
dispatch, no re-render of anything else.

The run is also recorded in session history (`EditorPane.svelte:60`) — a frontend
rune store, deliberately not a backend subsystem, because history is
session-only and doesn't justify a database.

## The shape to remember

```
Component  →  api/*.ts  →  invoke  ║  #[tauri::command]  →  service  →  sqlgen  →  driver  →  DB
   ↑                                ║                                                          │
   └──── ApiError.kind  ←  ErrorResponse JSON  ←  AppError  ←────────────────────────────────┘
```

Every feature in this app is that pipe. Grid edits, DDL, CSV import, git sync —
same eleven steps, different service.

---

# Part 5 — Reading order and exercises (10 min)

## Read these files, in this order

**Rust, easiest to hardest:**

1. `src-tauri/src/sqlgen/quote.rs` — 52 lines. Every core concept in miniature: enum, match, borrowing, `format!`, tests.
2. `src-tauri/src/state.rs` — 26 lines. Structs, `impl`, `Mutex`, `?`.
3. `src-tauri/src/commands/query.rs` — 31 lines. What a Tauri command is.
4. `src-tauri/src/errors/mod.rs` — enums with payloads, `impl`, traits, exhaustive match.
5. `src-tauri/src/drivers/mod.rs` — the architectural spine. Enum dispatch, async methods.
6. `src-tauri/src/services/query_service.rs` — real business logic + real tests.
7. `src-tauri/src/drivers/exec.rs` — generics and trait bounds. Hardest file in the repo. Save it.

**Svelte, easiest to hardest:**

1. `src/lib/utils/keyboard.ts` — plain TypeScript, no runes. Warm-up, and you'll spot the two issues from Part 1.
2. `src/lib/api/client.ts` — 43 lines, the IPC seam.
3. `src/lib/stores/tabs.svelte.ts` — the store pattern, including the getter idiom.
4. `src/lib/components/ui/VirtualList.svelte` — every rune plus snippets, in 71 lines. **If you read one Svelte file, read this one.**
5. `src/lib/components/layout/StartPanel.svelte` — loading/error/empty states, `{#each}`, snippets as props.
6. `src/lib/components/editor/EditorPane.svelte` — orchestration and typed error branching.
7. `src/lib/components/grid/DataGrid.svelte` — the most complex component. Snippets, keyboard handling, derived layout math.

## Exercises, in difficulty order

**1. Read-only (10 min).** Open `sqlgen/quote.rs`. Change `quote_ident` to also
handle a hypothetical `Engine::Oracle`. Don't write it — just note every file that
stops compiling. That's the exhaustive-match payoff, felt directly.

**2. Rust, small (20 min).** Add a `CellValue` variant or a new `AppError` variant
and follow the compiler until it's green. It will walk you through `kind()`,
`detail()`, and the mirrored TypeScript union in `src/lib/api/types.ts`. This is
the single best way to feel how Rust's exhaustiveness turns refactors into
checklists.

**3. Svelte, small (20 min).** In `StartPanel.svelte`, add a row to the shortcuts
list. Then try to add it *without* touching `utils/shortcuts.ts` — you can't,
because there's one catalogue. Notice how that constraint prevented the docs from
drifting.

**4. Real (45 min).** Fix finding (a) from Part 1: change
`keyboard.ts`'s `Map<string, ShortcutHandler>` to support multiple handlers per
combo without breaking the unregister contract at `keyboard.ts:68`. There's a
co-located test file at `utils/keyboard.test.ts` — **write the failing test first**
(register the same combo twice, unregister the second, assert the first fires
again), then make it pass. That's the repo's stated rule: every bugfix lands with a
regression test.

## Commands you'll need

```bash
pnpm install                                        # once
pnpm tauri dev                                      # run the real app
pnpm check                                          # svelte-check + vitest
cd src-tauri && cargo clippy -- -D warnings         # Rust lint (build-blocking)
cd src-tauri && cargo test                          # Rust tests
```

Use `pnpm`, never `npm` or `npx`.

`cargo check` is much faster than `cargo build` when you only want to know whether
it compiles. During a refactor, that's the loop you want.

## Rust survival kit

- The compiler is a teacher, not a gatekeeper. Error messages name the fix, often literally quoting the line to change. Read them fully — they're multi-paragraph on purpose.
- `cargo clippy` will suggest more idiomatic code. Take the suggestions; that's how you learn idiom.
- When you hit a borrow-checker fight, the answer is usually "clone it and move on." Optimize later, if a profiler says so. Fighting the borrow checker for elegance on day three is a waste of a day.
- `.unwrap()` is fine in tests and prototypes. In production code it's a panic waiting to happen — this repo uses it in tests and essentially nowhere else.
- Rust Book chapters 4 (ownership), 6 (enums), 9 (errors), and 10 (generics/traits) cover 90% of what this codebase uses. Skip the rest for now.

## Svelte survival kit

- If a tutorial shows `export let`, `$:`, `on:click`, or `<slot>`, it's Svelte 4 and wrong for this repo. Verify against https://svelte.dev/docs/svelte.
- Reactivity is read-tracked and synchronous. If something doesn't update, ask "did I *read* that signal during render, or did I stash it in a plain variable first?"
- Destructuring a `$state` object breaks reactivity — `const { a } = someState` copies the value out. Read through the object.
- `$state` mutation works. Stop reaching for spread-and-reassign.
- The runes are the API. There are six, you've seen five of them.

---

## The two-sentence summary

The Rust half is a strictly layered pipeline — commands delegate to services,
services gate and orchestrate, drivers dispatch on a three-variant enum, and one
error enum crosses the IPC boundary with a typed `kind` the frontend switches on.
The Svelte half is signals in modules: `$state` for data, `$derived` for
computation, getters to export it, snippets to compose it, and exactly one file
per domain allowed to call `invoke`.

Learn `VirtualList.svelte` and `exec.rs` and you've learned this codebase's two
hardest ideas: snippet-based composition, and generic monomorphized dispatch.
Everything else is those patterns repeated.
