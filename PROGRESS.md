# Implementation Progress Tracker

> Working log so any session can resume. Source of truth for *what's done*.
> Design authority: `DESIGN.md` (UI) · `docs/superpowers/specs/2026-07-21-basalt-db-studio-design.md` (arch/scope).
> Update this file as items land. `[x]` done · `[~]` in progress · `[ ]` not started.

## Current position

**M0 COMPLETE + M1 all three engines (SQLite · Postgres · MySQL) connect →
introspect → browse COMPLETE — verified against real engines.**
Both sides green: frontend `pnpm check` (svelte-check 0/0/0, 12 vitest) + `pnpm
build`; backend `cargo fmt --check` / `cargo clippy --all-targets -D warnings` /
`cargo test` — **14 unit + 4 integration** passing. Integration ran live against
`postgres:16` + `mysql:8` from `docker-compose.test.yml` (connect, introspect,
describe_table type/PK/index assertions, and wrong-password → `authFailed` per
engine). Credential path: **memory-only password** (transient command arg; the
profile still has no password field), wired form → in-memory stash → connect.

**M2 backend COMPLETE + verified** (types, `sqlgen/`, per-engine `values.rs`
decode, generic batch exec, `query_service::run` + `run_query` command). 34 lib +
6 integration tests green against real pg16/mysql8. **Next M2 = frontend** (CM6
editor + results grid + history/tabs stores) — see the M2 section below. (The
secrets slice below is a separable M1 tail; M2 frontend is the active thread.)

**Secrets slice (separable M1 tail):**
- `secrets/` — Keychain default + EncryptedFile vault (argon2id + ChaCha20), so
  passwords survive restart. Replaces the in-memory stash; keeps the no-field
  invariant (profile stores a `secretRef` only).
- Auto-prompt on `authFailed` at connect time (nicer than edit→save→connect).
- TLS ladder **UI** (mode + custom CA / client cert paths) — backend mapping is
  already done and honored by the pg/mysql openers.
- `tunnel/` (russh), workspace restore + auto-reconnect, SQLite file-picker.

### Verification commands (all pass locally as of M0)
- `pnpm check` — svelte-check + vitest
- `pnpm build` — vite production build
- `cd src-tauri && cargo clippy --all-targets -- -D warnings && cargo fmt --check && cargo test`

### Key decisions / gotchas (M0)
- create-tauri-app `svelte-ts` template is **SvelteKit** → not used; reused only
  its Rust `src-tauri` skeleton + icons + build.rs. Frontend hand-built for plain Vite.
- **TypeScript pinned to ^6** — svelte-check 4.7.3 crashes on TS 7 (native port
  changed the API). Do not bump TS to 7 until svelte-check supports it.
- Deferred UI primitives (not in M0 "core" list; build when first needed in M1/M2):
  Tabs, Tooltip, TreeItem, ContextMenu, DropdownMenu.
- `state.rs` (AppState sessions/config) intentionally deferred to M1 — nothing to
  hold yet. sqlx/keyring/russh deps also land in M1 so the empty-app bundle
  measurement stays honest.
- Updater: throwaway signing key generated; pubkey in tauri.conf.json, private key
  in session scratchpad (NOT committed). M7 replaces with the real key + endpoint.
- Nothing committed yet (awaiting user go-ahead on the first commit).

## Environment (verified)

- node v26.5.0 · pnpm 10.18.3 · rustc/cargo 1.96.0 (>= MSRV 1.94) · tauri-cli 2.11.4
- git remote: `origin https://github.com/Chadgeaptuni/Basalt-DB-Studio.git`, branch `dev`
- Platform: macOS (darwin 25.5). Build matrix (mac/win/linux) is CI-only.

## M0 — Scaffold  ·  Gate: CI green 3 OSes, empty bundle < 30 MB

- [x] Baseline (plain Vite + Svelte 5 + TS), pnpm — hand-built (SvelteKit template rejected)
- [x] Tailwind v4 CSS-first (`@tailwindcss/vite`, `@import "tailwindcss"`, `@theme inline`)
- [x] Cargo.toml: thiserror, tracing(+subscriber+appender), serde/serde_json, updater; release profile (lto, codegen-units=1, opt-level="s", panic="abort", strip). (sqlx/keyring/russh → M1)
- [x] tauri.conf.json: CSP (ipc: http://ipc.localhost), frontendDist=../dist, build.removeUnusedCommands
- [x] capabilities/default.json (core:default + updater:default)
- [x] errors/mod.rs — AppError enum + ErrorResponse{kind,message,detail}, all 20 kinds (+unit tests)
- [~] state.rs — deferred to M1 (no sessions/config to hold yet)
- [x] tracing -> rotating daily file log (tracing-appender) in OS log dir (via app_log_dir)
- [x] api/client.ts (typed invoke -> throws ApiError{kind}) + api/types.ts (ErrorKind union)
- [x] stores/toasts.svelte.ts + stores/dialogs.svelte.ts (confirm(): Promise<boolean>) + theme.svelte.ts
- [x] app.css: @import tailwindcss + @theme inline tokens + themes imports + base layer (focus-visible, reduced-motion)
- [x] themes/tokens.css (contract) + basalt-dark (default) + basalt-light
- [x] ui core primitives: Button, IconButton, Input, Select, Checkbox, Modal, ConfirmDialog, Toast, Spinner, EmptyState, Badge, Kbd, VirtualList, SplitPane, icon.ts
- [~] ui deferred primitives (build when needed): Tabs, Tooltip, TreeItem, ContextMenu, DropdownMenu
- [x] layout: AppShell (mod+b sidebar toggle), Sidebar, StatusBar (theme toggle), ToastHost, ConfirmDialogHost; App.svelte; data-theme via theme.apply() in main.ts
- [x] utils: keyboard.ts (single shortcut registry) + debounce.ts (+tests)
- [x] updater plugin + sign config (throwaway key; pubkey in conf, private key in scratchpad)
- [x] CI (.github/workflows/ci.yml): check / integration / build jobs (agent)
- [x] scripts/check-bundle-size.mjs (fails > 30 MB) (agent)
- [x] docker-compose.test.yml (postgres:16 + mysql:8) + tests/fixtures/{pg,mysql}-init.sql (agent)
- [x] Verified locally: `pnpm check` ✓, `pnpm build` ✓, `cargo clippy -D warnings` ✓, `cargo fmt --check` ✓, `cargo test` ✓
- [x] `pnpm tauri build` bundle measured (macOS aarch64): **DMG 2.41 MB · .app 4.69 MB · binary 4.6 MB** — vs 30 MB ceiling. Huge headroom for M1 drivers.
- [ ] CI green on 3 OSes — only runnable on GitHub Actions (not verifiable locally)

## M1 — Connect + introspect + schema browse

**In progress. All three engines now connect → introspect → browse.** TLS-UI /
SSH / secrets-vault / workspace are the NEXT M1 increments.

Frontend (DONE, verified — svelte-check 0/0/0, build clean):
- [x] api/types.ts — connection + schema wire contract (Engine, TLS, SSH, ConnectionProfile, SessionInfo, SchemaTree, ColumnInfo, TableDescription)
- [x] api/connections.ts + api/introspect.ts (typed invoke wrappers)
- [x] stores/connections.svelte.ts (profiles, per-conn status, active session) + schema.svelte.ts (introspection cache + lazy describe)
- [x] components/connections/ ConnectionForm (create/edit, Test button) + ConnectionList (load/empty/error + per-item connect states, delete-confirm)
- [x] components/schema/ SchemaTree (namespaces→relations→lazy columns; loading/empty/error)
- [x] ui/TreeItem primitive; Sidebar wired (ConnectionList + SchemaTree vertical split); StatusBar shows active connection

Backend (all three engines — DONE, verified: fmt/clippy clean, 14 unit + 4 integration):
- [x] config/ (paths, connections [no password field; path-traversal-safe ids], settings) TOML
- [x] drivers/ enum {Sqlite, Postgres, MySql} + types.rs (mirrors types.ts) — enum dispatch, no dyn
- [x] sqlite/introspect (pragma_* TVFs, bound params)
- [x] pg/introspect (information_schema tables grouped by schema; pg_catalog + `format_type` for canonical column types, PK via primary index, indexes incl. implicit PK index; $1/$2 bound)
- [x] mysql/introspect (info_schema, all non-system DBs as namespaces; `column_type` for full type, `column_key='PRI'` for PK; UPPERCASE labels aliased to lowercase; `CAST(non_unique AS SIGNED)` for stable i64; `?` bound)
- [x] connection_service: per-engine openers, connect timeout, TLS ladder → Pg/MySql ssl_mode + cert paths, `map_connect_error` (SQLSTATE 28 → authFailed, Tls → tlsError, else connectionRefused)
- [x] credential path: memory-only password threaded through connect/test_connection commands (profile still has no password field)
- [x] commands/ connections + introspect (thin) wired into lib.rs generate_handler!
- [x] INTEGRATION verified live vs postgres:16 + mysql:8: connect, introspect, describe_table (type/PK/index), wrong-password→authFailed per engine

### M1 decisions / gotchas
- **`removeUnusedCommands` set to FALSE** (was true in M0). It strips commands it
  can't see as static `invoke("literal")`, but our api layer routes every call
  through a wrapper with a *dynamic* command string → it would strip ALL commands
  in release builds (dev unaffected — latent bug). ~25 MB size headroom makes the
  optimization unnecessary. Revisit only if we add build-time invoke annotations.
- SQLite introspection uses `pragma_table_info(?)`/`pragma_index_list(?)`/`pragma_index_info(?)`
  table-valued fns with BOUND names (injection-safe), not string-interpolated PRAGMA.
- **`docker-compose.test.yml` host ports remapped to 55432 / 33306** (were 5432 /
  3306) so a developer's own local Postgres/MySQL doesn't shadow the containers —
  a local pg on 5432 silently ate the test connections. CI is unaffected (isolated
  service containers on standard ports). Env-var examples updated in the compose header.
- **MySQL 8 labels `information_schema` result columns UPPERCASE**; sqlx `try_get`
  is case-sensitive, so every mysql introspection column is aliased to lowercase.
- MySQL `mysql:8` uses `caching_sha2_password`; the container enables TLS by
  default and our default `ssl_mode` is `Preferred`, so full auth works over the
  auto-negotiated TLS. No extra config needed.
- **Pending manual step (can't run GUI in sandbox):** `pnpm tauri dev`, create a
  pg/mysql connection, enter password, Test → connect → expand tree → verify
  columns; exercise the `authFailed`/empty/error states.

Deferred to next M1 increments:
- [~] password form section — memory-only DONE; keychain/vault persistence remains
- [ ] secrets/ (Keychain default + EncryptedFile vault argon2id+ChaCha20); auto-prompt on authFailed
- [ ] tunnel/ (russh: key/passphrase/password/agent)
- [~] TLS ladder — backend mapping (mode + CA/client-cert paths) DONE & honored; **form UI** remains
- [ ] workspace restore + auto-reconnect (workspace.toml, not git-synced)
- [ ] file-picker for SQLite path (tauri-plugin-dialog); saved_queries config

## M2 — SQL editor + run + history

**Backend DONE + verified (34 lib + 6 integration tests, clippy/fmt clean).** The
whole run path works on all three engines against real `postgres:16`/`mysql:8`.
- [x] wire types: `CellValue` (adjacently tagged), `StatementResult` (+`error`),
  `StatementError`, `TxStatus`, `RunResult` in `drivers/types.rs` + `api/types.ts`.
  `BytesPreview::from_bytes` is the shared blob-preview site.
- [x] `sqlgen/` split.rs (quotes/comments/`$tag$`, `statement_at`, `mask_noise`),
  classify.rs (`confirmation_reason`, `is_read_only`, `returns_rows`, `tx_effect`),
  quote.rs — 14 corpus tests.
- [x] per-engine `values.rs` decode. Verified specifics found the hard way:
  **mysql `TINYINT(1)` reports type `BOOLEAN`** (→ `Bool`); **pg enums do NOT
  decode via `try_get::<String>`** — read the raw value bytes as UTF-8 (an enum's
  binary form is its label). NUMERIC/DECIMAL/`BIGINT UNSIGNED` → `Decimal(String)`;
  json → `Json`; bytea/blob → hex preview; pg `INT4[]`/… → `Array`; else `Unknown`.
- [x] `drivers/exec.rs`: one generic `run_batch` (fetch-side row limit;
  `execute` for DML via an `Affected` adapter — sqlx exposes no generic
  `rows_affected`; **`fetch_many` is deprecated in 0.9**, so row-returning vs DML
  is split by `sqlgen::returns_rows`).
- [x] `query_service::run`: split → read-only gate → confirmation gate
  (`ConfirmationRequired{detail}`) → batch on one pooled connection → per-statement
  `StatementResult`, stop at first error. `run_query` command + `api/query.ts`.

**Deferred within M2 (backend, next-next):** per-session *pinned* connection for
cross-run transactions (current slice is batch-scoped; `tx_status` is always
`Idle`); **cancellation** (capture pg `pg_backend_pid()` / mysql `CONNECTION_ID()`
at connect; cancel via side pool `pg_cancel_backend` / `KILL QUERY`; SQLite
drop+reopen) + cancel registry; **statement timeout** (auto-cancel →
`queryCancelled`). Also: columns are taken from the first row, so an empty result
set has no column headers (revisit if it matters).

**Next M2 increment — frontend (editor + results):**
- [ ] history.svelte.ts session store (pushed from frontend as results return)
- [ ] tabs store (sql / results / running / txStatus / dirty)
- [ ] CM6 editor: add `@codemirror/*` + `@codemirror/lang-sql` deps;
  `sql({ schema, dialect })` autocomplete fed from the schema store; format via
  lazy `sql-formatter`; run keymap ⌘↵ (run-all / run-selection) + run-at-cursor
  (send buffer + cursor offset — `run_query` already accepts `cursorOffset`).
- [ ] results grid (reuse `VirtualList`; per-statement result tabs; NULL badges,
  right-aligned numbers, type tooltips from `ColumnInfo`; render a statement's
  `error` on its tab), StatusBar tx indicator. Editor container wires
  `queryApi.run` → results + pushes to history.

## M3 — Data grid CRUD
- [ ] grid_service, bind direction in values.rs, CellEditor, staging commit/rollback, insert/delete, table-data view
- [ ] grid_roundtrip.rs all engines; no-PK fallback + ambiguousRowIdentity

## M4 — DDL
- [ ] ddl_service, per-engine ddl.rs, TableDesigner/IndexEditor, DDL preview modal, tree context-menu, cache refresh

## M5 — Import / export
- [ ] streamed CSV/JSON export (re-run query, ipc::Channel progress), CSV import wizard (insert/upsert/skip), file dialogs

## M6 — Git-sync
- [ ] gitsync/ (system git), saved-queries UI, sync panel + status badge; leak test

## M7 — Theming polish + release hardening
- [ ] remaining presets, ThemePicker, datetime-display setting, keyboard audit, empty/error-state audit, icons/metadata, signed/notarized release workflow + updater endpoint, bundle size per OS

## Notes / decisions log
- (append notable deviations, gotchas, doc findings here as work proceeds)
