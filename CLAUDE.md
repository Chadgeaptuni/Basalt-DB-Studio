# Working on Basalt DB Studio as an AI agent

Basalt DB Studio is an open-source, cross-platform database GUI (PostgreSQL,
MySQL/MariaDB, SQLite) — a lightweight, polished, keyboard-driven alternative to
DBeaver/Beekeeper. Built with **Tauri 2 (Rust backend, sqlx) + Svelte 5 (runes) +
Vite + Tailwind CSS v4 + CodeMirror 6**. GPL-3.0-only.

Frontend lives at `src/`, backend at `src-tauri/src/`. Use `pnpm` (not npm/yarn)
for JS; run `cargo` from inside `src-tauri/`.

**Hard constraints (can veto features and dependencies):**
1. Installed bundle < 30 MB; lightweight is a first-class goal.
2. macOS + Windows + Linux from day one.
3. Secrets never touch the config dir or git — connection TOML holds a
   `secret_ref` only; the type has no password field by construction.

The full architecture, milestones, and technical decisions live in
[docs/superpowers/specs/2026-07-21-basalt-db-studio-design.md](docs/superpowers/specs/2026-07-21-basalt-db-studio-design.md) — read it before
starting any milestone work.

## Official documentation is the source of truth — not model memory

This stack moves fast and training data IS stale for it. Before using any API
from the frameworks below, verify against the official docs (fetch them; don't
guess). Concretely, these v1-era facts already differ from common model memory:

- **Tailwind v4 is CSS-first**: `@tailwindcss/vite` plugin, `@import "tailwindcss"`,
  tokens via `@theme` in CSS. There is **no `tailwind.config.js`**, no PostCSS
  setup, no `content` array. Never generate a v3-style config.
- **Svelte 5**: runes (`$state`/`$derived`/`$effect`/`$props`); snippets — slots
  are deprecated; `onclick` not `on:click`; no event modifiers; callback props
  not `createEventDispatcher`; shared state lives in `.svelte.ts` modules that
  export objects/accessors (exporting a reassigned primitive is a compile error).
- **sqlx 0.9** (not 0.8): TLS feature is `tls-rustls-ring-webpki`; the combined
  `runtime-tokio-native-tls`-style features were deleted; query functions take
  `impl SqlSafeStr`, so user-supplied SQL needs `AssertSqlSafe` — central to this
  app. MSRV 1.94.
- **keyring 4.x**: per-platform stores are feature flags —
  `windows-native-keyring-store` and `zbus-secret-service-keyring-store` are
  defaults, **`apple-native-keyring-store` must be enabled explicitly**.
- **Tauri 2**: high-throughput data to the frontend uses `tauri::ipc::Channel` —
  events are officially unsuitable for streaming. Permissions live in
  `src-tauri/capabilities/*.json`; enable `build.removeUnusedCommands`.

Docs registry (use these; don't invent URLs):

| Topic | Official source |
|---|---|
| Tauri 2 | https://v2.tauri.app — `start/frontend/vite`, `security/capabilities`, `security/csp`, `develop/state-management`, `develop/calling-frontend`, `concept/size`, `develop/tests/mocking` |
| Svelte 5 | https://svelte.dev/docs/svelte — `$state`, `$props`, `v5-migration-guide`, `testing` |
| Tailwind v4 | https://tailwindcss.com/docs — `installation/using-vite`, `theme` |
| CodeMirror 6 | https://codemirror.net/docs + https://github.com/codemirror/lang-sql (schema-aware autocomplete is built into `sql({ schema, dialect })`) |
| sqlx | https://docs.rs/sqlx (incl. `attr.test.html` for `#[sqlx::test]`) |
| keyring / russh / thiserror | https://docs.rs/keyring · https://docs.rs/russh · https://docs.rs/thiserror |
| Postgres / MySQL / SQLite SQL semantics | https://www.postgresql.org/docs/ · https://dev.mysql.com/doc/ · https://sqlite.org/docs.html |

When implementing engine-specific behavior (introspection queries, type
handling, cancellation, quoting), cite the engine's own docs — never assume the
Postgres answer applies to MySQL or SQLite.

## Design system — DESIGN.md is the source of truth

**[DESIGN.md](DESIGN.md)** governs all UI/UX and frontend architecture. Read it
before writing or editing any Svelte/Tailwind code. Zero-tolerance summary
(DESIGN.md governs on any conflict):

- ❌ No gradients, glassmorphism/`backdrop-blur`, shadows/glows, colored card
  borders, color literals outside the token files, emoji in UI, bouncy entry
  animations, hero empty states, skeleton shimmer, or generic "Something went
  wrong" errors.
- Depth = contrast + 1px `--outline-variant` lines. Accent used sparingly. All data text
  is `font-mono`. Dense, flat, keyboard-driven.
- Every view defines loading, empty, AND error states; every error `kind` gets a
  specific, actionable rendering.
- If a proposed diff contains `shadow-`, `bg-gradient-`, a hex color, `invoke(`
  outside `src/lib/api/`, or logic inside `components/ui/` — rewrite it before
  presenting it (full checklist: DESIGN.md "Agent Execution Directive").

## graphify

This project has a knowledge graph at `graphify-out/` with god nodes, community
structure, and cross-file relationships across `src/`, `src-tauri/src/`, and
`docs/`.

Rules:
- For codebase questions, first run `graphify query "<question>"` when
  `graphify-out/graph.json` exists — answer from the graph instead of
  re-reading/grepping files from scratch; it's the token-cheap path.
- Use `graphify path "<A>" "<B>"` for how two things relate and
  `graphify explain "<concept>"` for a focused explanation of one node.
- If `graphify-out/wiki/index.md` exists, use it for broad navigation instead
  of raw source browsing.
- Read `graphify-out/GRAPH_REPORT.md` only for broad architecture review or
  when query/path/explain don't surface enough context.
- After modifying code, run `graphify update .` to keep the graph current
  (AST-only re-extraction, no API cost — safe after every substantive change).

## Architecture map

Backend layering — dependencies point one way: `commands → services → everything
else`. Nothing below `services/` imports `tauri`.

- `src-tauri/src/commands/` — thin `#[tauri::command]` handlers, one file per
  domain (connections, introspect, query, grid, ddl, history, export, import,
  gitsync, settings). Deserialize → call service → map error. No logic.
- `services/` — business logic (connection/session registry, query limits +
  cancel registry, grid edit→SQL, DDL generation, import/export, history, gitsync).
- `drivers/` — `enum Driver { Pg | MySql | Sqlite }` (enum dispatch, no dyn
  traits); `types.rs` holds the wire types (`CellValue`, `ColumnMeta`,
  `QueryResult`, …) mirrored in `src/lib/api/types.ts`; per-engine
  `pg|mysql|sqlite/{introspect,values,ddl}.rs`. `values.rs` is the single place
  engine types map to/from `CellValue`.
- `sqlgen/` — identifier quoting, multi-statement splitting, destructive-statement
  classification (shared, heavily unit-tested).
- `config/` (TOML profiles + saved queries — the git-sync unit), `secrets/`
  (`SecretStore`: OS keychain default, encrypted-file backend opt-in), `tunnel/`
  (russh), `gitsync/` (shells out to system git), `errors/` (below). Query
  history is session-only and lives in a frontend rune store — no backend
  history subsystem, no local DB.

Frontend layout — see DESIGN.md §9 for the import rules:

- `src/lib/components/ui/` — dumb reusable primitives with variants via props.
- `src/lib/components/[domain]/` — smart containers (stores + api + ui).
- `src/lib/stores/*.svelte.ts` — global runes state; no state library.
- `src/lib/api/` — the ONLY home of `invoke()`; typed wrappers + `ApiError`.
- `src/themes/` — token presets as `[data-theme]` CSS variable blocks.

## Error-kind policy

One `AppError` enum in `src-tauri/src/errors/mod.rs` (`thiserror`), serialized
as `ErrorResponse { kind, message, detail }`. Every user-facing failure mode has
a distinct `kind` the frontend switches on (`connectionRefused`, `authFailed`,
`tlsError`, `tunnelError`, `queryError`, `queryCancelled`, `readOnlyViolation`,
`noPrimaryKey`, `ambiguousRowIdentity`, `confirmationRequired`, `secretNotFound`,
`keychainUnavailable`, `vaultLocked`, `configIo`, `configParse`,
`gitNotInstalled`, `gitConflict`, `gitDirty`, `importParse`,
`internal`). New failure mode ⇒ new variant — never a new string matched in the
frontend, never a collapsed generic error.

## Code-quality hard rules

1. **No code duplication — ever.** Before writing anything, search the codebase
   (and `graphify query` — see "graphify" above) for existing logic/components
   that already do it; reuse or extend. A second copy of any logic (a local
   toast, a re-implemented debounce, a forked button) is a bug to fix, not a
   style choice.
2. **No dead code, no unused variables/params/imports.** Delete, don't comment
   out. Enforced: `cargo clippy -- -D warnings` and `svelte-check` must pass
   clean; both are build-blocking.
3. **No monolithic files.** One responsibility per file; split when a file
   approaches ~300 lines. No god components, no grab-bag `utils.ts`.
4. **No over-engineering.** Enum dispatch over trait objects; runes over state
   libraries; a ~100-line hand-rolled `VirtualList` over a grid dependency. The
   30 MB ceiling and this rule beat architectural astronautics.
5. **Comments explain non-obvious WHY only** — never restate what the code says.
6. **Every reusable behavior is declared once, globally**: toasts
   (`stores/toasts.svelte.ts`), confirm dialogs (`stores/dialogs.svelte.ts`),
   keyboard shortcuts (`utils/keyboard.ts`), debounce, cell formatting. Call
   sites consume the service; they never re-create it.

## Testing rules

- **Every bugfix lands with a co-located regression test** that reproduces the
  bug. No exceptions — this applies from the first bug onward.
- Rust unit tests are co-located (`#[cfg(test)]`); the `sqlgen/` splitter/
  classifier corpus and per-engine `values.rs` decode tables are the
  highest-value suites — extend them with every edge case found.
- Integration tests (`src-tauri/tests/`) run against real engines via
  `docker-compose.test.yml` (postgres + mysql, seeded with edge-type fixtures);
  they read `BASALT_TEST_*_URL` env vars and self-skip when unset. SQLite tests
  always run.
- Frontend: `vitest` + `@testing-library/svelte`, co-located `*.test.ts`;
  mock IPC with the official `@tauri-apps/api/mocks` (`mockIPC`/`clearMocks`).
- Passing tests ≠ done: run the app (`pnpm tauri dev`) and exercise the change
  including its error/empty states before calling it complete.

## Performance rules

- Virtualize unbounded lists; zero IPC per keystroke (schema cache + debounce);
  buffered query results with auto row-limit; pre-format cells once per fetch.
- Release profile stays size-optimized (`lto`, `codegen-units = 1`,
  `opt-level = "s"`/`"z"`, `panic = "abort"`, `strip`) — don't touch it to "fix"
  a perf issue without measuring.
- `scripts/check-bundle-size.mjs` fails CI over 30 MB. Adding a dependency
  requires justifying its size; prefer the standard library or ~100 lines of
  our own code over a crate/package that drags a tree.

## Workflow

1. Commit format: `type(scope): short description` (e.g. `fix(grid): rollback
   batch on ambiguous row identity`).
2. Do not bump version numbers (`package.json`, `tauri.conf.json`, `Cargo.toml`)
   — done manually by the project owner.
3. Build commands:
   ```bash
   pnpm install            # once, or after dependency changes
   pnpm tauri dev          # run the app (frontend + Rust backend)
   pnpm check              # svelte-check + vitest run
   cd src-tauri && cargo clippy -- -D warnings && cargo test
   ```
   If a check fails, fix the reported error — never paper over it.
