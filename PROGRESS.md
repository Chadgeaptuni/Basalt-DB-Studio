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

**M2 COMPLETE (backend + frontend) + verified.** Backend: types, `sqlgen/`,
per-engine `values.rs` decode, generic batch exec, `query_service::run` +
`run_query` (34 lib + 6 integration tests, real pg16/mysql8). Frontend: CM6 editor
(schema autocomplete, run keymap, lazy format), virtualized results grid +
per-statement tabs, session tabs/history stores (svelte-check 0/0/0, 23 vitest,
build clean). **M3 COMPLETE (backend + frontend) + verified** — editable table-data
view, transactional commit, no-PK fallback + ambiguousRowIdentity (40 lib + 2
grid_roundtrip + 6 integration). **M4 COMPLETE** — DDL generation, preview-before-
execute, tree actions. **M5 COMPLETE (backend + frontend) + verified** — streaming
CSV/JSON export (ipc::Channel), CSV import with per-engine conflict modes + line
errors. **M6 COMPLETE** — manual git-sync (system git) + saved-queries UI + sync
bar; leak test (two clones share config, no plaintext secret). **M7 COMPLETE (code)**
— settings persistence, datetime-display wiring, 4 theme presets + picker, keyboard
+ error-state audits, release workflow scaffold (signing/notarization/real updater
key are owner+CI steps, unverifiable here). **M0–M7 all done.** Full backend gate
green: **72 tests** (59 lib + 2 ddl + 1 gitsync + 2 grid + 2 import roundtrip + 6
integration) vs real pg16/mysql8; frontend svelte-check 0/0/0, 36 vitest, build
clean. **Remaining: the separable M1 secrets slice** (keychain/vault + auto-prompt +
TLS-ladder/SSH UI) and the deferred M2 backend items (pinned-tx connection,
cancellation, statement timeout). GUI (`pnpm tauri dev`) still wants a manual pass.

**UI restructure (post-M7, frontend only):** the Schema panel is the object
explorer *and* the connection list — every saved profile is a tree root and
expanding one connects it (pgAdmin's shape), several sessions open at once,
connect/disconnect/edit/delete on the root's context menu. The status-bar
switcher is now a label (`ConnectionLabel`) and the start pane no longer lists
profiles; `ConnectionSwitcher` and `ConnectionRow` are deleted. Rail panel swaps
are an instant cut (the fade-through helpers are gone — the incoming panel laid
out inside the animation), the rail item keeps its state layer in both states (a
click used to flash pale before the tonal pill arrived), and rows inside a
divided list take the new `stateLayerFlush` full-bleed wash. GUI pass still
owed.

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

**M2 frontend — DONE + verified** (svelte-check 0/0/0, 23 vitest, `pnpm build`
clean; CM6 in main chunk, `sql-formatter` lazy-split):
- [x] `stores/tabs.svelte.ts` (sql / result / running / activeStatement / runError)
  + `stores/history.svelte.ts` (session-only, newest-first, capped 200).
- [x] `utils/cellDisplay.ts` — pre-format CellValue once per fetch (text / isNull /
  numeric / title). `ui/Tabs.svelte` primitive (editor + result tabs).
- [x] CM6 editor (`components/editor/`): `cm.ts` (token-only theme + highlight,
  per-engine dialect, cache-fed `sql({schema,dialect})` autocomplete, run keymap),
  `CodeEditor.svelte` (thin host), `EditorPane.svelte` (tabs/toolbar/orchestration).
  ⌘↵ run-at-cursor/selection, ⌘⇧↵ run-all, ⌘⇧F format (lazy `sql-formatter`).
  **Cursor offset converted UTF-16→UTF-8 bytes** before `run_query` (`statement_at`
  takes a byte offset). Destructive → `confirm()` → re-run confirmed.
- [x] `components/grid/DataGrid.svelte` (read-only windowed grid; NULL/number/tooltip;
  `VirtualList` extended with sticky header + `contentWidth`), `ResultsPane.svelte`
  (loading/empty/error, per-statement tabs, live elapsed), `history/HistoryPanel.svelte`
  (virtualized, click-to-reload), `workspace/Workspace.svelte`; StatusBar tx/rows/ms.

**M2 frontend deferred (small, revisit in M3):** grid cell selection + `Ctrl+C`
copy and editor error-position underline (needs `queryError` detail offset) land
with the editable grid in M3. NULL renders as inline `text-grid-null italic` (exact
DESIGN §3 token/style) rather than the pill `Badge`. Run-at-cursor logs the whole
buffer to history (frontend never splits — splitting is backend-only).

## M3 — Data grid CRUD — COMPLETE + verified

Backend (clippy/fmt clean; 40 lib + 2 grid_roundtrip + 6 integration, real pg16/mysql8):
- [x] Grid wire types (BrowseResult, GridEdit, CellChange, GridCommitResult);
  AmbiguousRowIdentity carries the failing edit index.
- [x] bind direction in each `values.rs` (reverse of decode): **Postgres = text +
  `::type_name` cast** (uniform for numeric/json/array/enum/date); **MySQL/SQLite =
  by CellValue kind** (TINYINT(1) bool → 1/0, not "true").
- [x] `drivers/grid.rs`: one generic transactional commit loop (SET/WHERE/INSERT via
  QueryBuilder; whole batch in one tx; `rows_affected == 1` per UPDATE/DELETE →
  else rollback + `ambiguousRowIdentity`; NULL identity → `IS NULL`).
- [x] `grid_service` browse (table-data view: describe → SELECT limit+1; identity =
  PK or all-non-binary fallback; editable flag + noPrimaryKey reason) + commit
  (read-only gate, column/binary validation, needs-identity gate).
- [x] `grid_browse`/`grid_commit` commands. `grid_roundtrip.rs` (pg+mysql) + SQLite
  unit tests cover PK CRUD, no-PK fallback, ambiguous rollback, NULL identity.
- [x] **fix:** pg binary numeric over-pads trailing zeros (2.75→"2.7500"); trimmed
  at the decode site (+regression test).

Frontend (svelte-check 0/0/0; 32 vitest; build clean):
- [x] tableEdits.ts (pure, tested): parseCell / buildEdits / pendingCount.
  tableData store: per-tab browse + staging, optimistic display, one-tx commit
  (failure keeps staging + shows error).
- [x] DataGrid gains an optional edit controller (results grid stays read-only):
  inline editor, arrow/Enter/Delete(→NULL)/Ctrl+C-TSV, dirty/inserted/deleted
  styling. TableDataView: Add/Delete row, Revert, Commit (confirm on deletes),
  read-only + no-PK notices. Shared `utils/copy.ts` (TSV, NULL→empty).
- [x] Tabs gain kind (sql|table) + ref; tab bar moved to Workspace, which routes
  sql→editor/results, table→TableDataView. Double-click a tree relation opens it.

**Deferred (M3 tail):** Advanced Copy modal (⌘⇧C: header/delimiter/quoting);
SQLite `rowid` fallback (all-columns fallback covers it now); grid keyboard nav is
grid-local (role=grid), not the global registry (justified like the CM keymap).

## M4 — DDL — COMPLETE + verified

Backend (47 lib + 2 ddl_roundtrip, real pg16/mysql8; clippy/fmt clean):
- [x] `DdlRequest`/`ColumnSpec` wire types; **`sqlgen/ddl.rs`** generates SQL for
  create/alter/drop table + create/drop index, parameterized by engine (one tested
  corpus, not three driver files — deviation from the map, justified: pure text +
  DRY). Dialect facts learned: `RENAME TO` takes a **bare** name; **SQLite CREATE
  INDEX's ON target must be unqualified** (schema attaches to the index name);
  DROP INDEX needs `ON <table>` (MySQL), schema-qualified (pg), bare (SQLite).
- [x] `ddl_service::generate` + `ddl_generate` command. **Execution reuses the run
  path** (`run_query` confirmed) + schema refresh on the frontend — no separate
  execute command. Gate met: generate→execute→introspect roundtrip all engines.

Frontend (svelte-check 0/0/0; 32 vitest; build clean):
- [x] `stores/ddl.svelte.ts` routes the active dialog; `DdlHost` renders it (like
  ToastHost). **Every DDL flows through `DdlPreviewModal`** (generate → show exact
  SQL → Execute → refresh cache) — the spec's "SQL preview before execute" gate.
- [x] TableDesigner (new table), ColumnDialog (add column), IndexDialog (create
  index), RenameDialog. `ui/ContextMenu` primitive (deferred from M0); schema tree
  right-click → Open data / Add column / Create index / Rename / Drop; header
  'New table'.

**Deferred (M4 tail):** full ALTER COLUMN type-change, drop-index UI, editable
preview SQL, namespace picker in the designer (uses the first namespace / the
right-clicked one). Drop uses the preview modal as its confirmation.

## M5 — Import / export — COMPLETE + verified

Backend (54 lib + 2 import_roundtrip, real pg16/mysql8; clippy/fmt clean):
- [x] **Streaming export** (`drivers/export.rs` RowSink + `export_service`): re-runs
  the query and streams the FULL result (never buffered) to CSV/JSON, progress over
  `ipc::Channel` — 100k rows use flat memory, no UI freeze. CSV/JSON hand-written;
  JSON preserves column order. `export_query` + `export_table` commands.
- [x] **CSV import** (`drivers/import.rs` + `import_service`): small RFC4180 parser
  → per-row parameterized INSERT with each engine's native conflict form (pg
  `ON CONFLICT DO NOTHING|UPDATE`; mysql `INSERT IGNORE`/`ON DUPLICATE KEY UPDATE`;
  sqlite `INSERT OR IGNORE`/`ON CONFLICT`), one transaction; a rejected row rolls
  back + reports its line (`importParse`). Binding reuses each `values.rs` bind.
- [x] `tauri-plugin-dialog` for file pickers; `dialog:default` capability.

Frontend (svelte-check 0/0/0; 32 vitest; build clean):
- [x] `runExport`: save dialog (format = extension) → stream over a Channel → toast.
  Wired to Export a whole table (TableDataView) and a query result (ResultsPane).
- [x] `ImportWizard`: open dialog, target-column mapping, header + conflict mode;
  errors surface with the offending line.

**Deferred (M5 tail):** live progress bar (Channel wired, currently a sticky
toast); multi-row VALUES batching (per-row INSERT in one tx now); CSV header
auto-mapping / column reorder (needs the fs plugin to read the header); quoted-empty
vs NULL distinction (empty field → NULL in v1).

## M6 — Git-sync — COMPLETE + verified

Backend (clippy/fmt clean; +1 gitsync_roundtrip test, runs without Docker):
- [x] `gitsync/mod.rs` — shells **system git** in the config dir (no git2/gix).
  `status` (installed/isRepo/hasRemote/branch/dirty/ahead/behind) + `sync`
  (add -A → commit → pull --rebase → push). Missing git → `gitNotInstalled`;
  a sync-caused rebase conflict → `gitConflict` (auto `rebase --abort`, tree left
  clean); a pre-existing unfinished rebase/merge → `gitDirty`. First push skips
  the pull (upstream ref not born yet).
- [x] `config/saved_queries.rs` — `.sql` files under nestable folders (the 2nd
  git-sync unit); path-traversal-safe. `Paths::under()` added (all paths under one
  dir; tests pass a temp). Commands: `git_status`/`git_sync` (blocking thread) +
  `list/read/save/delete` saved queries.
- [x] **Gate met locally**: `gitsync_roundtrip.rs` — bare repo + two clones share
  profiles + saved queries through sync (A push, B pull); leak test greps BOTH
  working trees for a sentinel secret (absent — profile has no password field).

Frontend (svelte-check 0/0/0; 36 vitest; build clean):
- [x] `api/{gitsync,savedQueries}.ts`, `stores/{gitsync,savedQueries,saveQuery}.svelte.ts`.
- [x] Sidebar nests a 3rd section: `SavedQueriesPanel` (folder-grouped tree, open
  into a tab, context-menu delete) + `GitSyncBar` (branch/dirty/ahead-behind badge,
  Sync button, inline gitConflict/gitDirty/gitNotInstalled states). `Ctrl+S` saves
  the active tab (bound → overwrite; new → `SaveQueryDialog`). tabs gain `savedPath`.
  `IconButton` extended with a `loading` state (reused, not forked).

**Deferred (M6 tail):** no in-app conflict resolution (spec — "resolve in your git
tool"); no auto/background sync (spec v1 = manual); `git init`/add-remote is a
user step (v1 assumes the config dir is already a repo with a remote); no
saved-query rename/move UI (delete + re-save).

## M7 — Theming polish + release hardening — COMPLETE (code); release-infra unverifiable here

Backend (clippy/fmt clean; +1 settings test → **59 lib**):
- [x] `config/settings.rs` load/save + `get_settings`/`save_settings` commands
  (settings.toml: `defaultRowLimit` + `datetimeDisplay`; git-syncable).

Frontend (svelte-check 0/0/0; **36 vitest**; build clean):
- [x] `stores/settings.svelte.ts` (loads at startup; setters persist optimistically)
  + `SettingsModal` (flat list: ThemePicker, datetime display, default row limit).
- [x] **datetime display** (as-stored/local/UTC) wired through `formatCell` — only
  an *offset* timestamp converts (naive stays naive); +4 regression tests. Default
  row limit flows into every `run`.
- [x] 2 more token-complete presets (**basalt-nord**, **basalt-paper**) + `ThemePicker`;
  StatusBar quick toggle recognises all dark presets (`DARK_THEMES`) + a gear button.
- [x] keyboard audit: added `Ctrl+PgUp/PgDn` tab cycling (map now complete minus the
  deferred cancel + `Ctrl+K` palette). error-state audit: connect failures get
  kind-specific actionable headings in `ConnectionList`.
- [x] app metadata: macOS 13 floor, longDescription; `.github/workflows/release.yml`
  (tag-driven, tauri-action, signs + notarizes + draft release with updater
  artifacts). **Gotcha:** `createUpdaterArtifacts` must NOT live in the base config —
  it forces the updater tarball to be signed, so every unsigned `tauri build` (local
  + the CI size-gate) fails "no private key". It's enabled only in `release.yml` via
  an inline `--config` where the signing key exists.
- [x] **Release bundle re-measured (macOS aarch64, this arc's deps):** DMG **4.13 MB**
  · .app **7.93 MB** · binary 8.1 MB — vs the 30 MB ceiling. `scripts/check-bundle-
  size.mjs` passes. (M0 was 2.41/4.69; sqlx×3 + rustls account for the growth.)

**Deferred / NOT verifiable in this environment (owner + CI):** actual code-signing
(Apple Developer ID / Windows Authenticode), notarization, the **real updater key +
endpoint** (still the M0 throwaway key; `releases.basalt.studio` is a placeholder),
per-OS install test on macOS 13 / Win 11 / webkit2gtk-4.1, automated WCAG contrast
check on presets (chosen for clear contrast by hand), and a v1.0 draft release from
CI. The secrets slice (keychain/vault) also remains — the connect path is still
memory-only, so `secretNotFound`/`keychainUnavailable`/`vaultLocked` can't yet fire.

## Notes / decisions log
- (append notable deviations, gotchas, doc findings here as work proceeds)
