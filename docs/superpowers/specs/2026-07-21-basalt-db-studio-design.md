# Basalt DB Studio — Design & Implementation Guide (v2)

Open-source, cross-platform database GUI. A lightweight, polished alternative to
DBeaver / Beekeeper Studio / pgAdmin. Query + admin in one app.

- **License:** MIT
- **Stack:** Tauri 2 · Svelte 5 (runes) + Vite · Tailwind CSS v4 · CodeMirror 6 · Lucide icons
- **Backend:** Rust, `sqlx` 0.9
- **v1 design:** 2026-07-21 · **v2 (implementation guide):** 2026-07-22

Companion documents: **[CLAUDE.md](../../../CLAUDE.md)** (agent working rules,
official-docs mandate, quality gates) and **[DESIGN.md](../../../DESIGN.md)**
(design-system source of truth). On UI questions DESIGN.md governs; on process
questions CLAUDE.md governs; this spec owns architecture and scope.

---

## Hard constraints

1. **Bundle < 30 MB, lightweight is a first-class goal.** Must still feel
   polished and finished, not stripped. This constraint can veto features and
   dependencies. Enforced in CI by `scripts/check-bundle-size.mjs`.
2. **Cross-platform:** macOS, Windows, Linux from day one (Tauri build matrix in CI).
3. **Secrets never leak into git.** Connection TOML stores a `secret_ref` (UUID)
   only — the profile struct has no password field, making leakage a type error.

## Differentiators (where we invest)

- **Polished, fast, keyboard-driven UX** with customizable themes.
- **Git-sync for teams:** a plain-file config dir that *is* a git repo. Shares
  connection configs (no secrets) and saved queries/snippets.

---

## Verified stack facts (checked against official docs, 2026-07-22)

These override model-memory assumptions. Re-verify against the CLAUDE.md docs
registry when in doubt — never implement from memory.

| Component | Verified fact |
|---|---|
| Tauri | 2.11.x; scaffold with `create-tauri-app` 4.6.x. High-throughput data to the frontend uses `tauri::ipc::Channel` (events are officially unsuitable for streaming). Permissions via `src-tauri/capabilities/*.json`; CSP under `app.security.csp` (needs `ipc: http://ipc.localhost`); enable `build.removeUnusedCommands` (≥2.4). State: `app.manage(...)` + `State<'_, T>`; async commands use `tokio::sync::Mutex`. |
| Frontend template | Tauri's official Svelte template is SvelteKit + adapter-static (SPA); plain Vite is an equally official path. **Decision: plain Vite + `@sveltejs/vite-plugin-svelte`** — single-window app, no routing needs, less machinery, smaller surface. |
| Svelte | 5.56.x. Runes; snippets (slots deprecated); `onclick` not `on:click`; callback props not dispatchers; shared state in `.svelte.ts` modules exporting objects/accessors. |
| Vite / TS | Vite 8, TypeScript 6.x. |
| Tailwind | 4.3.x, **CSS-first**: `@tailwindcss/vite` plugin, `@import "tailwindcss"`, tokens via `@theme`. No `tailwind.config.js`, no PostCSS config, no `content` array. |
| CodeMirror | `@codemirror/lang-sql` 6.10 has schema-aware autocomplete built in: `sql({ schema, dialect, defaultTable })`, fed from our schema store. |
| sqlx | **0.9** (breaking vs 0.8): features `postgres` + `mysql` + `sqlite` + `runtime-tokio` + `tls-rustls-ring-webpki` (combined runtime-TLS features deleted). Query fns take `impl SqlSafeStr` → user-supplied SQL wrapped in `AssertSqlSafe`. MySQL text columns infer `String`. `#[sqlx::test]` gives per-test isolated DBs. **MSRV 1.94.** |
| keyring | **4.x** re-architecture: stores are feature-flagged crates — `windows-native-keyring-store` (default), `zbus-secret-service-keyring-store` (default), `apple-native-keyring-store` (**must enable explicitly**). |
| russh | 0.62.x (SSH tunnel / bastion support). |
| Toolchain | Windows: MSVC + WebView2. Linux: webkit2gtk 4.1. Release profile per official size guide: `codegen-units=1, lto=true, opt-level="s", panic="abort", strip=true` (measure `"s"` vs `"z"`). |

---

## Architecture

DB drivers must run in Rust — the webview cannot speak DB wire protocols. Svelte
calls Tauri commands; Rust owns all data access.

```
Svelte UI ──invoke──▶ commands ──▶ services ──▶ Driver enum (Pg | MySql | Sqlite)
                                      │              └─ sqlx, rustls, russh tunnel
                                      ├─▶ config dir (TOML)  ◀── git-sync unit
                                      ├─▶ local SQLite       ◀── query history
                                      └─▶ SecretStore        ◀── keychain | encrypted file
```

### Backend — `src-tauri/`

Layering rule: **commands → services → (drivers | sqlgen | config | secrets |
tunnel | history | gitsync)**. Commands are thin (deserialize → service → map
error). Nothing below `services/` imports `tauri`.

```
src-tauri/
├── Cargo.toml                    # release profile; sqlx/keyring features as above
├── tauri.conf.json               # CSP, frontendDist, removeUnusedCommands
├── capabilities/default.json
├── migrations/                   # history DB, numbered 0001_..., additive only
├── src/
│   ├── main.rs / lib.rs / state.rs   # builder, tracing init, AppState { sessions, history, config }
│   ├── errors/mod.rs             # AppError (thiserror) → ErrorResponse { kind, message, detail }
│   ├── commands/                 # one file per domain: connections, introspect, query,
│   │                             # grid, ddl, history, export, import, gitsync, settings
│   ├── services/                 # connection_service (SessionRegistry), query_service,
│   │                             # grid_service, ddl_service, export/import_service,
│   │                             # history_service, gitsync_service
│   ├── drivers/
│   │   ├── mod.rs                # enum Driver { Pg, MySql, Sqlite } — the ONLY match-dispatch site
│   │   ├── types.rs              # wire types: ColumnMeta, CellValue, QueryResult, SchemaTree, TxStatus
│   │   └── pg/ mysql/ sqlite/    # each: mod.rs, introspect.rs, values.rs, ddl.rs
│   ├── sqlgen/                   # quote.rs (per-engine identifiers), split.rs (multi-statement),
│   │                             # classify.rs (destructive detection)
│   ├── tunnel/mod.rs             # russh local port-forward, owned by Session
│   ├── config/                   # paths.rs, connections.rs (NO secret fields — secret_ref only),
│   │                             # saved_queries.rs, settings.rs   (all TOML)
│   ├── secrets/                  # mod.rs: SecretStore { Keychain (default) | EncryptedFile (opt-in) }
│   ├── history/mod.rs            # local SQLite via sqlx; runs migrations/
│   └── gitsync/mod.rs            # shells out to system git
└── tests/                        # integration: common/ harness (env-gated), pg_integration,
                                  # mysql_integration, sqlite_integration, grid_roundtrip
```

Key backend decisions:

- **Session model:** one connected DB tab = a `Session` holding a dedicated sqlx
  connection for user queries (so `BEGIN`, temp tables, `SET` persist) plus a
  small side pool (max 2) for introspection and cancellation. No cross-session
  pool sharing. Lazy connect; explicit disconnect frees the connection and any
  SSH tunnel task.
- **Enum dispatch, no dyn traits.** Engine differences live in `pg/ mysql/
  sqlite/` submodules; `drivers/mod.rs` is the single match site.
- **Error strategy:** one `AppError` enum serialized as `ErrorResponse { kind,
  message, detail }`; every command returns `Result<T, ErrorResponse>`. Kinds
  (frontend switches on these; new failure mode = new variant, never a string):
  `connectionRefused` · `authFailed` · `tlsError` · `tunnelError` · `queryError`
  (detail: engine code + error position for editor underline) · `queryCancelled`
  · `readOnlyViolation` · `noPrimaryKey` · `ambiguousRowIdentity` ·
  `confirmationRequired` (detail: classified statements) · `secretNotFound` ·
  `keychainUnavailable` · `vaultLocked` · `configIo` · `configParse` ·
  `gitNotInstalled` · `gitConflict` · `gitDirty` · `importParse` (detail: line)
  · `historyDb` · `internal`.

### Frontend — `src/`

Rules (full contract in DESIGN.md §9): `components/ui/` is dumb; all `invoke()`
lives in `lib/api/`; global state = runes modules; no state library.

```
src/
├── main.ts / App.svelte          # AppShell + ToastHost + ConfirmDialogHost + data-theme
├── app.css                       # @import "tailwindcss" + @theme tokens + themes/*.css imports
├── themes/                       # tokens.css (contract docs) + basalt-dark/light/… ([data-theme] blocks)
└── lib/
    ├── api/                      # client.ts (typed invoke wrapper → throws ApiError{kind}),
    │                             # types.ts (TS mirror of drivers/types.rs), one module per domain
    ├── stores/                   # *.svelte.ts runes: connections, schema (introspection cache →
    │                             # tree + CM6 autocomplete), tabs (sql/result/running/txStatus/dirty),
    │                             # history, toasts, dialogs, theme, settings
    ├── components/
    │   ├── ui/                   # Button, IconButton, Input, Select, Checkbox, Modal, ConfirmDialog,
    │   │                         # Toast/ToastHost, Tabs, Tooltip, ContextMenu, DropdownMenu,
    │   │                         # EmptyState, Spinner, Badge, Kbd, SplitPane, VirtualList, TreeItem
    │   ├── layout/               # AppShell, Sidebar, StatusBar
    │   ├── connections/ schema/ editor/ grid/ ddl/ importExport/ gitsync/ settings/
    └── utils/                    # debounce, cellDisplay, keyboard (single shortcut registry), format
```

Global services declared once (DESIGN.md §9): `toast.success|error|info()` and
`confirm(): Promise<boolean>`; hosts mounted once in `App.svelte`. Backend
`confirmationRequired` errors funnel through `confirm()` → re-invoke with
`confirmed: true`.

### Storage

- **Config dir** (`~/.config/basalt/` or OS equivalent, via `dirs`): connection
  profiles + saved queries + app settings as TOML. Human-readable, diff-able,
  and directly usable as the git-sync repo.
- **Local SQLite:** query history only (searchable, re-runnable; excluded from
  git because it grows). Migrations numbered, additive.
- **Secrets — decided (was v1's open question): both backends behind one
  `SecretStore` interface.**
  - **Default: OS keychain** via `keyring` 4.x (service `basalt-db-studio`,
    account = connection UUID, secret = JSON blob: password + SSH passphrase).
    Secrets never exist as files; git-sync cannot leak them structurally.
  - **Opt-in: encrypted vault file** for teams that want syncable secrets:
    argon2id KDF + ChaCha20-Poly1305, master password unlocks per session;
    ciphertext lives in the config dir and MAY be git-synced. Wrong password /
    locked vault → `vaultLocked`.
  - `keychainUnavailable` (e.g. headless Linux) → per-connect password prompt,
    held in memory only — an explanatory state, not a crash.
  - Deleting a connection deletes its secret in the active backend. An M6 test
    greps the entire synced dir for known plaintext test secrets after a full
    save/connect/sync cycle.

---

## Key technical designs

### Type mapping (engine ⇄ grid)

One serde-tagged `CellValue` enum in `drivers/types.rs`, identical across
engines, mirrored in `lib/api/types.ts`:

`Null` · `Bool` · `Int(i64)` · `Float(f64)` · `Text` · `Decimal(String)`
(NUMERIC/DECIMAL/u64 — string, never f64) · `Date`/`Time`/`DateTime` (ISO 8601,
offset preserved for timestamptz) · `Json(Value)` · `Bytes { len, preview }`
(hex of first 64 bytes; full blobs not shipped in v1) · `Array(Vec<CellValue>)`
(Pg, recursive) · `Unknown { type_name, display }` (geometry, ranges, custom
types → text representation).

`ColumnMeta { name, type_name, nullable, is_pk }` accompanies rows so the grid
renders NULL badges, aligns numbers, and shows type tooltips without guessing.
Decode lives in each engine's `values.rs` — the **single** edge-type site,
unit-tested per engine (Pg enums decode as `Text`; unmatched types fall back to
text cast, else `Unknown`).

### Grid CRUD

- **Editable surface (v1 rule):** CRUD only in the *table data view* (opened
  from the schema tree), where the target table is unambiguous. Arbitrary query
  results are read-only — this eliminates result-to-table provenance guessing
  without a SQL parser.
- Edits arrive as a batch → `grid_service` generates parameterized statements
  (`UPDATE t SET a=$1 WHERE pk=$2`); bind conversion is the reverse direction of
  `values.rs`; Pg tricky columns get explicit casts from `type_name`
  (`$1::jsonb`, `$1::int4[]`).
- **Row identity:** PK from introspection. Fallbacks: SQLite → hidden `rowid`
  column; Pg/MySQL without PK → WHERE over all original non-binary values inside
  a transaction, and if `rows_affected != 1` → rollback + `ambiguousRowIdentity`.
  Binary/`Unknown` cells are read-only in v1.
- The whole batch runs in **one transaction**; any failure rolls everything back
  and returns the failing statement index (frontend highlights the row).

### Query lifecycle

- **Buffered with fetch-side auto-limit** (no SQL rewriting): stream via sqlx
  `fetch()`, collect at most `limit + 1` rows (default 500, configurable), set
  `truncated: true` and stop polling. UI shows "first 500 rows" + one-click
  re-run higher. Streaming rows to the UI is deliberately out of v1; if it ever
  lands, it uses `tauri::ipc::Channel`, not events.
- **Cancellation** (`query_service` keeps `QueryId → CancelHandle`):
  Pg → capture `pg_backend_pid()` at connect, cancel via
  `SELECT pg_cancel_backend($1)` on the side pool. MySQL → `CONNECTION_ID()` +
  `KILL QUERY <id>`. SQLite → abort the task and drop+reopen the connection
  (cheap); an open explicit tx is reported lost via `queryCancelled` detail.
- **Transactions / autocommit:** the session's dedicated connection is the tx
  boundary. `TxStatus { idle | inTx | error }` tracked per session (Pg from
  connection status; MySQL/SQLite by statement classification). Status bar shows
  tx state; disconnect with open tx prompts via `confirm()`.
- **Multi-statement scripts:** `sqlgen/split.rs` splits on `;` respecting
  quotes, `--` and `/* */` comments, Pg `$$` dollar-quoting, MySQL backticks.
  (No `DELIMITER` support in v1 — documented limitation.) Statements run
  sequentially; response is `Vec<StatementResult>`; execution stops at first
  error. **Splitting logic lives only in Rust** — run-selection sends selected
  text; run-at-cursor sends the buffer + cursor offset and the splitter picks
  the containing statement.
- **Safety rails:** `sqlgen/classify.rs` flags `DROP | TRUNCATE | ALTER |
  DELETE/UPDATE without WHERE` → `confirmationRequired` unless the call carries
  `confirmed: true`. Read-only connections reject non-SELECT with
  `readOnlyViolation`, plus the engine-level read-only session setting where
  available as a second layer.
- Every executed statement (success or failure, duration, row count) is written
  to history fire-and-forget — never blocking the result path.

### Git-sync

Shell out to **system git** (no `git2`/`gix` — bundle weight, and target users
have git). Config dir is the repo. "Sync" = `add -A` → `commit` →
`pull --rebase` → `push`. Missing git → `gitNotInstalled` with an actionable
state; conflicts → `gitConflict` ("resolve in your git tool, then retry") — v1
builds no merge UI. History DB and secrets are never inside the synced dir.

---

## Testing strategy

- **Rust unit (co-located `#[cfg(test)]`):** `sqlgen/` corpus (quoting,
  comments, dollar-quoting — highest-value suite), `classify.rs`, per-engine
  `values.rs` decode tables, `grid_service` SQL generation (assert SQL + bind
  order), `config/` TOML round-trips, error serialization shape.
- **Rust integration (`src-tauri/tests/`):** real engines via
  `docker-compose.test.yml` (postgres:16 + mysql:8, seed fixtures covering edge
  types: arrays, jsonb, enums, decimals, dates, blobs). Tests read
  `BASALT_TEST_PG_URL`/`BASALT_TEST_MYSQL_URL` and self-skip when unset (local
  `cargo test` stays green without Docker); SQLite runs unconditionally.
  Flagship: `grid_roundtrip.rs` — introspect → fetch page → edit batch →
  re-read → assert, on all engines. History DB uses `#[sqlx::test]`.
- **Frontend:** vitest + `@testing-library/svelte`, co-located `*.test.ts`:
  store logic (tabs, toasts, dialogs promise resolution, schema cache),
  `VirtualList` windowing math, autocomplete config from a mocked schema store.
  IPC mocked via official `@tauri-apps/api/mocks`. `svelte-check` is the type
  gate.
- **Regression policy:** every bugfix lands with a co-located test reproducing
  it (CLAUDE.md rule; applies from the first bug).
- **CI (`.github/workflows/ci.yml`):**
  1. `check` (ubuntu, every PR): `cargo fmt --check`, `cargo clippy -D warnings`,
     `cargo test` (unit + sqlite), `pnpm svelte-check`, `pnpm vitest run`.
  2. `integration` (ubuntu, every PR): postgres + mysql as service containers,
     env URLs set, run the integration suites.
  3. `build` matrix (ubuntu/windows/macos; tags + weekly + label): `pnpm tauri
     build` + `scripts/check-bundle-size.mjs` (fails > 30 MB, prints per-artifact
     sizes).

## Performance plan

- **Hand-rolled `VirtualList`** (~100 lines: fixed row height, `$derived`
  visible range, ±10 overscan, spacer divs) — reused by grid, history, schema
  tree. Data is already bounded by the row limit; only DOM is windowed. Cell
  text pre-formatted once per fetch.
- **Zero IPC per keystroke:** schema loaded into `schema.svelte.ts` on connect
  (manual refresh + auto-refresh after DDL); CM6 completion reads it
  synchronously; inputs debounced 200 ms.
- **Connections:** per-session dedicated conn + side pool `max_connections(2)`,
  `acquire_timeout(5s)`, `idle_timeout(300s)`.
- **Size:** official release profile (above); features `pg`/`mysql`/`sqlite`
  map to sqlx features so per-driver cost is measurable (`cargo bloat` in M1,
  recorded in `docs/bundle-size.md`); rustls only; per-icon `lucide-svelte`
  imports; CM6 packages only as needed; `sql-formatter` lazy-`import()`ed.
  Escalation if the ceiling nears: audit transitive deps → feature-flag engines.

---

## v1 Scope

### Included (P0)

| Area | Features |
|------|----------|
| Engines | PostgreSQL, MySQL/MariaDB, SQLite; TLS/SSL modes |
| Connections | Test button, read-only toggle, SSH tunnel |
| Browse | Schema tree (DBs, schemas, tables, columns, indexes, views) |
| Editor | Schema-aware autocomplete, format, multi-tab, multi-statement, query history |
| Data | Inline grid CRUD (edit/insert/delete, commit/rollback) |
| DDL | Create / alter / drop tables & indexes (SQL preview before execute) |
| Import/Export | CSV/JSON export of results; CSV import into tables |
| Safety | Confirm destructive stmts; tx control; auto row-limit; query cancel |
| Teams | Git-sync of connection configs (no secrets) + saved queries |
| Theming | Preset color schemes (token-based) |
| Platforms | macOS, Windows, Linux |

### Milestones (all within v1) — each gate blocks the next

**M0 — Scaffold.** create-tauri-app (plain Vite + Svelte 5 + TS), Tailwind v4,
release profile, CSP + capabilities + `removeUnusedCommands`, `errors/mod.rs`,
`api/client.ts` + `types.ts` skeleton, toasts/dialogs stores + hosts, `@theme`
tokens + dark/light presets, AppShell/Sidebar/StatusBar, core `ui/` primitives
(Button, Input, Select, Modal, Spinner, EmptyState, Toast, ConfirmDialog,
VirtualList, SplitPane, Kbd), CI jobs, size-check script, docker-compose.test.yml.
*Gate: CI green on all 3 OSes; empty-app bundle measured < 30 MB.*

**M1 — Connect + introspect + schema browse.** `config/`, `secrets/` (both
backends), `tunnel/`, `drivers/` enum + per-engine `introspect.rs`,
`connection_service`, connections + schema tree UI, read-only toggle, Test
button with distinct error kinds rendered.
*Gate: real Pg/MySQL/SQLite connections incl. TLS + SSH tunnel; introspect
integration tests pass; per-driver size recorded.*

**M2 — SQL editor + run + history.** `sqlgen/` (split/classify/quote),
`query_service` (limits, cancel registry, tx tracking), per-engine `values.rs`
decode, `history/` + migration 0001, CM6 editor (autocomplete from schema store,
format, keymap), tabs store, read-only results grid on VirtualList, StatusBar tx
indicator.
*Gate: run-selection, multi-statement, cancel, tx toggle work on all 3 engines;
splitter corpus green; history persisted + searchable.*

**M3 — Data grid CRUD.** `grid_service`, bind direction in `values.rs`,
CellEditor, pending-edit staging with commit/rollback, insert/delete rows,
table-data view from tree.
*Gate: `grid_roundtrip.rs` passes on all engines; no-PK fallback +
`ambiguousRowIdentity` verified.*

**M4 — DDL.** `ddl_service`, per-engine `ddl.rs`, TableDesigner/IndexEditor,
DDL preview modal, tree context-menu actions, schema cache refresh after DDL.
*Gate: create/alter/drop table + index round-trip on all engines; every DDL
shows generated SQL before execute.*

**M5 — Import / export.** Streaming CSV/JSON export, CSV import wizard (column
mapping, batched inserts in one tx), Tauri file dialogs, progress via
`ipc::Channel`.
*Gate: 100k-row export without UI freeze; import reports type errors by line.*

**M6 — Git-sync.** `gitsync/`, saved-queries UI, sync panel + status badge.
*Gate: two machines share profiles + saved queries through a repo; leak test
greps synced dir for plaintext secrets after full workflow; conflict shows
`gitConflict` state.*

**M7 — Theming polish + release hardening.** Remaining presets, ThemePicker,
keyboard-shortcut audit, empty/error-state audit across every error kind, app
icons/metadata, release workflow, bundle size recorded per OS.
*Gate: all presets pass contrast check; v1.0 draft release built from CI.*

### Deferred (post-v1)

- Additional engines (MSSQL, Oracle, MongoDB, …)
- ER diagrams, visual query builder
- AI / natural-language SQL
- Custom theme editor + custom CSS
- Plugins/extensions
- Server monitoring / DBA tooling (roles, vacuum, backups)
- Row streaming to the grid via `ipc::Channel`; full blob viewing/editing
- MySQL `DELIMITER` support; in-app git conflict resolution

## Resolved questions

1. **Secret storage** *(was the v1 blocker)*: **both** — OS keychain default
   (`keyring` 4.x), encrypted vault file (argon2id + ChaCha20-Poly1305, master
   password, git-syncable) opt-in. One `SecretStore` interface.
2. **Frontend template**: plain Vite + `@sveltejs/vite-plugin-svelte` (not
   SvelteKit) — single window, no routing, smaller.
3. **Git integration**: system git via subprocess (no libgit2/gix).

## Risks

- **Bundle size:** 3 drivers + rustls + russh may approach 30 MB. Mitigations:
  official size-optimized profile, per-driver measurement from M1, rustls only,
  dependency justification rule (CLAUDE.md), feature-flagged engines as last
  resort.
- **Type-system breadth:** edge types (arrays, JSON, enums, geometry) are
  contained in per-engine `values.rs` decode tables with explicit `Unknown`
  fallback — unit-tested, extended per edge case found.
- **sqlx cancellation semantics** differ per engine; the side-pool
  cancel design (pg_cancel_backend / KILL QUERY / reopen) needs early M2
  validation against real engines.
- **Windows/macOS keychain edge cases** (locked keychain, headless CI) are
  handled as explicit error kinds with password-prompt fallback, not crashes.
