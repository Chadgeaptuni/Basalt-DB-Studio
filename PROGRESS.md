# Implementation Progress Tracker

> Working log so any session can resume. Source of truth for *what's done*.
> Design authority: `DESIGN.md` (UI) · `docs/superpowers/specs/2026-07-21-basalt-db-studio-design.md` (arch/scope).
> Update this file as items land. `[x]` done · `[~]` in progress · `[ ]` not started.

## Current position

**M0 COMPLETE + M1 SQLite vertical slice COMPLETE — all verified locally.**
Both sides green: frontend `pnpm check` (svelte-check 0/0/0, 12 vitest) + `pnpm
build`; backend `cargo fmt --check` / `cargo clippy -D warnings` / `cargo test`
(14 passing, incl. connect→introspect→disconnect lifecycle). M0 bundle 2.41 MB
DMG. End-to-end SQLite connect → introspect → browse is wired and contract-verified.

**Next increment (start here):** extend M1 to Postgres + MySQL. That needs: sqlx
`postgres`/`mysql` features + `Driver::Pg`/`Driver::MySql` variants + per-engine
`introspect.rs`; a credential path (spec's memory-only per-connect password prompt
is the simplest first step, full keychain/vault after); TLS ladder mapping. **These
should be verified against real engines via `docker-compose.test.yml` — that
requires Docker + `BASALT_TEST_PG_URL`/`BASALT_TEST_MYSQL_URL`, not available in
the current sandbox.** Then: secrets/, tunnel/, workspace restore, file-picker.

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

**In progress. This session: SQLite-only vertical slice** (connect → introspect →
browse) as the first increment. pg/mysql/TLS/SSH/secrets-vault/workspace are the
NEXT M1 increments.

Frontend (DONE, verified — svelte-check 0/0/0, build clean):
- [x] api/types.ts — connection + schema wire contract (Engine, TLS, SSH, ConnectionProfile, SessionInfo, SchemaTree, ColumnInfo, TableDescription)
- [x] api/connections.ts + api/introspect.ts (typed invoke wrappers)
- [x] stores/connections.svelte.ts (profiles, per-conn status, active session) + schema.svelte.ts (introspection cache + lazy describe)
- [x] components/connections/ ConnectionForm (create/edit, Test button) + ConnectionList (load/empty/error + per-item connect states, delete-confirm)
- [x] components/schema/ SchemaTree (namespaces→relations→lazy columns; loading/empty/error)
- [x] ui/TreeItem primitive; Sidebar wired (ConnectionList + SchemaTree vertical split); StatusBar shows active connection

Backend (SQLite slice — DONE, verified: cargo fmt/clippy clean, 14 tests pass):
- [x] config/ (paths, connections [no password field; path-traversal-safe ids], settings) TOML
- [x] drivers/ enum {Sqlite} + types.rs (mirrors types.ts field-for-field) + sqlite/introspect (pragma_* TVFs, bound params)
- [x] connection_service (SessionRegistry, tokio Mutex, connect timeout→connectionRefused, read_only, create_if_missing(false)), state.rs AppState{sessions,paths} + app.manage
- [x] commands/ connections + introspect (thin) wired into lib.rs generate_handler!
- [x] INTEGRATION verified: types match, command names/args align, both test suites green
- pg/mysql `connect`/`test_connection` return clear Internal("… later M1 slice") for now

### M1 decisions / gotchas
- **`removeUnusedCommands` set to FALSE** (was true in M0). It strips commands it
  can't see as static `invoke("literal")`, but our api layer routes every call
  through a wrapper with a *dynamic* command string → it would strip ALL commands
  in release builds (dev unaffected — latent bug). ~25 MB size headroom makes the
  optimization unnecessary. Revisit only if we add build-time invoke annotations.
- SQLite introspection uses `pragma_table_info(?)`/`pragma_index_list(?)`/`pragma_index_info(?)`
  table-valued fns with BOUND names (injection-safe), not string-interpolated PRAGMA.
- **Pending manual step (can't run GUI here):** `pnpm tauri dev`, create a SQLite
  connection, connect, expand the tree, verify columns — exercise empty/error states.

Deferred to next M1 increments:
- [ ] pg + mysql drivers/introspect (add sqlx pg/mysql features + Driver variants)
- [ ] secrets/ (Keychain default + EncryptedFile vault argon2id+ChaCha20) + password/TLS/SSH form sections
- [ ] tunnel/ (russh: key/passphrase/password/agent)
- [ ] TLS ladder (disable→verify-full + custom CA/client cert)
- [ ] workspace restore + auto-reconnect (workspace.toml, not git-synced)
- [ ] file-picker for SQLite path (tauri-plugin-dialog); saved_queries config

## M2 — SQL editor + run + history
- [ ] sqlgen/ split.rs, classify.rs, quote.rs (+corpus tests)
- [ ] query_service (limits, cancel registry, statement timeout, tx tracking)
- [ ] per-engine values.rs decode
- [ ] history.svelte.ts session store
- [ ] CM6 editor (schema autocomplete, format, keymap), tabs store, results grid, per-statement result tabs, StatusBar tx

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
