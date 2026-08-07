# Basalt DB Studio — Design & Implementation Guide (v2)

Open-source, cross-platform database GUI. A lightweight, polished alternative to
DBeaver / Beekeeper Studio / pgAdmin. Query + admin in one app.

- **License:** GPL-3.0-only
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
2. **Cross-platform:** macOS, Windows, Linux from day one (Tauri build matrix in
   CI). Minimum targets: **macOS 13, Windows 11, and Linux with webkit2gtk 4.1**
   (e.g. Ubuntu 22.04+).
3. **Secrets never leak into git.** Connection TOML stores a `secret_ref` (UUID)
   only — the profile struct has no password field, making leakage a type error.
4. **No telemetry.** No analytics, crash reporting, or usage tracking of any
   kind. The only outbound network is the user's own DB connections, git-sync to
   their own remote, and the signed update check — a documented guarantee.

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
                                      └─▶ SecretStore        ◀── keychain | encrypted file
(query history lives in-memory in the Svelte UI, session-scoped)
```

### Backend — `src-tauri/`

Layering rule: **commands → services → (drivers | sqlgen | config | secrets |
tunnel | gitsync)**. Commands are thin (deserialize → service → map
error). Nothing below `services/` imports `tauri`.

```
src-tauri/
├── Cargo.toml                    # release profile; sqlx/keyring features as above
├── tauri.conf.json               # CSP, frontendDist, removeUnusedCommands
├── capabilities/default.json
├── src/
│   ├── main.rs / lib.rs / state.rs   # builder, tracing→rotating file log, AppState { sessions, config }
│   ├── errors/mod.rs             # AppError (thiserror) → ErrorResponse { kind, message, detail }
│   ├── commands/                 # one file per domain: connections, introspect, query,
│   │                             # grid, ddl, export, import, gitsync, settings
│   ├── services/                 # connection_service (SessionRegistry), query_service,
│   │                             # grid_service, ddl_service, export/import_service,
│   │                             # gitsync_service
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
  · `internal`.

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
  and directly usable as the git-sync repo. Saved queries are organized into
  **named files under nestable folders** (subdirectories) for clean diffs. TOML
  carries no schema-version field in v1 — fields are additive and unknown keys
  are tolerated (forward-compatible by convention); cross-version migration is
  deferred.
- **Query history is session-scoped and in-memory** (a frontend rune store fed
  from each `StatementResult`): searchable and re-runnable within the running
  app, cleared on quit. No local database, no migrations — nothing to persist,
  prune, or sync.
- **Workspace state** — open editor tabs with their unsaved SQL, and the
  last-active connections — persists per-machine in the config dir
  (`workspace.toml`, **not** git-synced). On launch, tabs are restored and
  sessions whose secret is available (keychain) are **auto-reconnected**;
  encrypted-vault / prompt-only connections restore as disconnected until
  unlocked.
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

**Datetime display is a user setting** (`as-stored` · `local` · `UTC`). The wire
value is always ISO 8601 exactly as the engine returns it (offset preserved for
timestamptz, naive stays naive); the setting transforms only how a cell is
*rendered*, never the stored or edited value.

### Connections, TLS & SSH

- **TLS/SSL** exposes the full Postgres-style ladder — `disable` · `require` ·
  `verify-ca` · `verify-full` — plus an optional **custom CA certificate** and
  **client cert/key** (rustls, configured per engine). Certs/keys are file-path
  references in the profile TOML, not secrets. Failures map to `tlsError`.
- **SSH tunnel** (russh) supports **private key (optional passphrase), password,
  and ssh-agent** auth. The key passphrase and the SSH password live in the
  `SecretStore` blob alongside the DB password; the key file itself is a path
  reference. Failures map to `tunnelError`.
- **Connect timeout** bounds the initial connection (configurable, default ~10s
  → fails fast to the matching connection error kind), separate from the
  per-query statement timeout below.

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
- **Table-data browse is buffered, not paged:** the data view loads the same
  `limit + 1` window as any query (default 500); v1 has **no** built-in
  pagination, click-to-sort, or column filters — refine with SQL. (Server-side
  paging/sort/filter is deferred.)
- **Editing UX:** double-click / `Enter` edits a cell inline; JSON and array
  cells edit as validated text; a **Set to NULL** action (context menu +
  shortcut) writes SQL `NULL`, kept distinct from empty string. Binary and
  `Unknown` cells remain read-only in v1. No separate value-viewer panel.
- **Copy:** `Ctrl+C` copies the selection as TSV (NULL → empty, no header);
  `Ctrl+Shift+C` opens **Advanced Copy** (toggle header row, choose delimiter,
  quoting) — a single shared implementation, no per-call-site copy logic.

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
- **Statement timeout:** a configurable per-connection timeout, **default off**.
  When set, a query exceeding it is auto-cancelled through the same cancel path
  and surfaced as `queryCancelled`; manual `Escape`/cancel is always available.
- **Result presentation:** a multi-statement run returns `Vec<StatementResult>`;
  the UI renders **one result tab per statement** (Result 1…n), the failing
  statement's tab carrying its `queryError`.
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
- Every executed statement (success or failure, duration, row count) is pushed
  to the in-memory history store from the frontend as results return — never on
  the result path's critical section.

### Git-sync

Shell out to **system git** (no `git2`/`gix` — bundle weight, and target users
have git). Config dir is the repo. Sync is **manual only in v1** (a Sync button;
no background/auto-sync): `add -A` → `commit` → `pull --rebase` → `push`. Missing
git → `gitNotInstalled` with an actionable state; conflicts → `gitConflict`
("resolve in your git tool, then retry") — v1 builds no merge UI. Secrets and the
per-machine `workspace.toml` are never inside the synced dir.

### Import / export

- **Export re-runs the query and streams the full result** to CSV/JSON — not
  just the buffered on-screen rows — with progress over `tauri::ipc::Channel`.
  An export is therefore complete even when the grid was truncated to the row
  limit. (M5's 100k-row gate.)
- **CSV import** offers a per-run conflict mode — **insert · upsert · skip
  duplicates** — emitting the engine's native form (`INSERT` /
  `INSERT … ON CONFLICT … DO UPDATE` (Pg) · `INSERT … ON DUPLICATE KEY UPDATE`
  (MySQL) · `INSERT OR IGNORE`/`INSERT OR REPLACE` (SQLite)). Rows batch inside
  one transaction; type/parse errors are reported by line (`importParse`).

### Distribution, updates & diagnostics

- **Signed, auto-updating builds:** release artifacts are code-signed (macOS
  notarization, Windows Authenticode) and ship the **Tauri updater plugin** for
  in-app updates. The updater's signed check is the app's only non-DB/non-git
  outbound call. Plugin + signing weight counts against the 30 MB ceiling
  (tracked from M0).
- **Logging:** `tracing` writes a **rotating log file** in the OS data/log dir
  (`tracing-appender`); no in-app log viewer in v1. Given the no-telemetry
  stance, this file is the primary diagnostic for bug reports.
- **Accessibility (v1):** full keyboard operability, `:focus-visible` rings, and
  `prefers-reduced-motion` (DESIGN.md §7). A formal ARIA / screen-reader pass is
  deferred.
- **Localization (v1):** English-only UI, strings inline; a translation catalog
  is deferred.

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
  re-read → assert, on all engines.
- **Frontend:** vitest + `@testing-library/svelte`, co-located `*.test.ts`:
  store logic (tabs, toasts, dialogs promise resolution, schema cache,
  session history store), `VirtualList` windowing math, autocomplete config
  from a mocked schema store, Advanced-Copy TSV formatting. IPC mocked via
  official `@tauri-apps/api/mocks`. `svelte-check` is the type gate.
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
| Engines | PostgreSQL, MySQL/MariaDB, SQLite |
| Connections | Test button, read-only toggle, TLS ladder (disable→verify-full, custom CA + client cert), SSH tunnel (key/passphrase/password/agent), connect timeout |
| Browse | Schema tree (DBs, schemas, tables, columns, indexes, views); buffered table-data view |
| Editor | Schema-aware autocomplete, format, multi-tab, multi-statement, per-statement result tabs, session query history |
| Data | Inline grid CRUD (edit/insert/delete, commit/rollback), Set-NULL, TSV + Advanced Copy |
| DDL | Create / alter / drop tables & indexes (SQL preview before execute) |
| Import/Export | Full-result streamed CSV/JSON export; CSV import (insert/upsert/skip) into tables |
| Safety | Confirm destructive stmts; tx control; auto row-limit; query cancel; configurable statement timeout |
| Teams | Manual git-sync of connection configs (no secrets) + saved queries (folders) |
| Theming | Preset color schemes (token-based); datetime display (stored/local/UTC) |
| Workspace | Restore open tabs + unsaved SQL; auto-reconnect on launch |
| Privacy | No telemetry; local rotating log file |
| Platforms | macOS 13+, Windows 11, Linux (webkit2gtk 4.1); signed + auto-updating |

### Milestones (all within v1) — each gate blocks the next

**M0 — Scaffold.** create-tauri-app (plain Vite + Svelte 5 + TS), Tailwind v4,
release profile, CSP + capabilities + `removeUnusedCommands`, `errors/mod.rs`,
`api/client.ts` + `types.ts` skeleton, toasts/dialogs stores + hosts, `@theme`
tokens + dark/light presets, AppShell/Sidebar/StatusBar, core `ui/` primitives
(Button, Input, Select, Modal, Spinner, EmptyState, Toast, ConfirmDialog,
VirtualList, SplitPane, Kbd), updater plugin + code-sign/notarize config,
`tracing`→rotating file log, CI jobs, size-check script, docker-compose.test.yml.
*Gate: CI green on all 3 OSes; empty-app bundle measured < 30 MB.*

**M1 — Connect + introspect + schema browse.** `config/`, `secrets/` (both
backends), `tunnel/` (key/passphrase/password/agent), `drivers/` enum +
per-engine `introspect.rs`, `connection_service`, TLS ladder (disable→verify-full
+ custom CA/client cert), connect timeout, workspace-state restore +
auto-reconnect, connections + schema tree UI, read-only toggle, Test button with
distinct error kinds rendered.
*Gate: real Pg/MySQL/SQLite connections incl. all TLS modes + SSH tunnel;
introspect integration tests pass; tabs/sessions restore on relaunch; per-driver
size recorded.*

**M2 — SQL editor + run + history.** `sqlgen/` (split/classify/quote),
`query_service` (limits, cancel registry, statement timeout, tx tracking),
per-engine `values.rs` decode, in-memory `history.svelte.ts` session store, CM6
editor (autocomplete from schema store, format, keymap), tabs store, read-only
results grid on VirtualList with per-statement result tabs, StatusBar tx
indicator.
*Gate: run-selection, multi-statement (result-tab per statement), cancel,
statement timeout, tx toggle work on all 3 engines; splitter corpus green;
session history searchable + re-runnable (clears on quit).*

**M3 — Data grid CRUD.** `grid_service`, bind direction in `values.rs`,
CellEditor, pending-edit staging with commit/rollback, insert/delete rows,
table-data view from tree.
*Gate: `grid_roundtrip.rs` passes on all engines; no-PK fallback +
`ambiguousRowIdentity` verified.*

**M4 — DDL.** `ddl_service`, per-engine `ddl.rs`, TableDesigner/IndexEditor,
DDL preview modal, tree context-menu actions, schema cache refresh after DDL.
*Gate: create/alter/drop table + index round-trip on all engines; every DDL
shows generated SQL before execute.*

**M5 — Import / export.** Full-result streamed CSV/JSON export (re-runs the
query), CSV import wizard (column mapping, insert/upsert/skip conflict mode,
batched inserts in one tx), Tauri file dialogs, progress via `ipc::Channel`.
*Gate: 100k-row export (full result, not just the buffered page) without UI
freeze; import conflict modes verified per engine; import reports type errors by
line.*

**M6 — Git-sync.** `gitsync/`, saved-queries UI, sync panel + status badge.
*Gate: two machines share profiles + saved queries through a repo; leak test
greps synced dir for plaintext secrets after full workflow; conflict shows
`gitConflict` state.*

**M7 — Theming polish + release hardening.** Remaining presets, ThemePicker,
datetime-display setting, keyboard-shortcut audit, empty/error-state audit across
every error kind, app icons/metadata, signed + notarized release workflow with
updater endpoint, bundle size recorded per OS.
*Gate: all presets pass contrast check; signed/notarized artifacts install
cleanly on macOS 13 / Windows 11 / webkit2gtk-4.1 Linux; the updater upgrades a
prior build; v1.0 draft release built from CI.*

### Deferred (post-v1)

- Additional engines (MSSQL, Oracle, MongoDB, …)
- ER diagrams, visual query builder
- AI / natural-language SQL
- Custom theme editor + custom CSS
- Plugins/extensions
- Server monitoring / DBA tooling (roles, vacuum, backups)
- Row streaming to the grid via `ipc::Channel`; full blob viewing/editing
- MySQL `DELIMITER` support; in-app git conflict resolution
- Server-side data-grid pagination, click-to-sort, and column filters
- Persistent (cross-session) query history
- In-app log viewer; opt-in crash reporting
- Screen-reader / ARIA accessibility pass
- Localization / i18n (translation catalog)
- Config-schema versioning + cross-version migration
- Auto / background git-sync

## Resolved questions

1. **Secret storage** *(was the v1 blocker)*: **both** — OS keychain default
   (`keyring` 4.x), encrypted vault file (argon2id + ChaCha20-Poly1305, master
   password, git-syncable) opt-in. One `SecretStore` interface.
2. **Frontend template**: plain Vite + `@sveltejs/vite-plugin-svelte` (not
   SvelteKit) — single window, no routing, smaller.
3. **Git integration**: system git via subprocess (no libgit2/gix).

## Risks

- **Bundle size:** 3 drivers + rustls + russh + the Tauri updater plugin may
  approach 30 MB. Mitigations: official size-optimized profile, per-driver
  measurement from M1, rustls only, dependency justification rule (CLAUDE.md),
  feature-flagged engines as last resort.
- **Type-system breadth:** edge types (arrays, JSON, enums, geometry) are
  contained in per-engine `values.rs` decode tables with explicit `Unknown`
  fallback — unit-tested, extended per edge case found.
- **sqlx cancellation semantics** differ per engine; the side-pool
  cancel design (pg_cancel_backend / KILL QUERY / reopen) needs early M2
  validation against real engines.
- **Windows/macOS keychain edge cases** (locked keychain, headless CI) are
  handled as explicit error kinds with password-prompt fallback, not crashes.
