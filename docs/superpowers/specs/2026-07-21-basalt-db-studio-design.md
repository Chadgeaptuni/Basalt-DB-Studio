# Basalt DB Studio — Design (v1)

Open-source, cross-platform database GUI. A lightweight, polished alternative to
DBeaver / Beekeeper Studio / pgAdmin. Query + admin in one app.

- **License:** MIT
- **Stack:** Tauri 2 · Svelte 5 (runes) + Vite · Tailwind CSS · CodeMirror 6 · Lucide icons
- **Backend:** Rust, `sqlx`
- **Date:** 2026-07-21

---

## Hard constraints

1. **Bundle < 30 MB, lightweight is a first-class goal.** Reference: Terax AI
   Terminal (~7–10 MB, feature-rich). Must still feel polished and finished, not
   stripped. This constraint can veto features and dependencies.
2. **Cross-platform:** macOS, Windows, Linux from day one (Tauri build matrix in CI).
3. **Secrets never leak into git.** (Storage model TBD — see Open questions.)

## Differentiators (where we invest)

- **Polished, fast, keyboard-driven UX** with customizable themes.
- **Git-sync for teams:** a plain-file config dir that *is* a git repo. Shares
  connection configs (no secrets) and saved queries/snippets.

---

## Architecture

DB drivers must run in Rust — the webview cannot speak DB wire protocols. Svelte
calls Tauri commands; Rust owns all data access.

```
Svelte UI  ──invoke──▶  Tauri commands  ──▶  Driver (enum: Pg | MySql | Sqlite)
                                              └─ sqlx pools, TLS (rustls)
Config dir (TOML)  ◀── git-sync unit
Local SQLite       ◀── query history (not synced; can grow large)
OS keychain / TBD  ◀── secrets
```

### Backend (Rust)

- One `Driver` interface, **enum dispatch** over `Pg | MySql | Sqlite` (no dyn
  trait objects needed). Methods: `connect`, `test`, `introspect` (schemas /
  tables / columns / indexes / views), `run_query`, `cancel`, tx control
  (`begin` / `commit` / `rollback`, autocommit toggle).
- `sqlx` for all three engines. TLS via `rustls` (required for hosted DBs:
  Supabase, RDS, Neon, PlanetScale).
- SSH tunnel support (`russh`) — connect through a bastion.
- Query results serialized to JSON (columns + typed rows + affected count).

### Frontend (Svelte)

- Svelte 5 runes + Vite. Tailwind for styling. Lucide icons.
- **SQL editor:** CodeMirror 6 — schema-aware autocomplete, format/prettify,
  multi-tab, run-selection / run-script.
- **Data grid:** virtualized (only render visible rows) for large result sets.
- **Themes:** CSS-variable design tokens. v1 ships presets (light/dark + a few);
  token architecture lets a custom editor drop in later with no rework.

### Storage (Approach: file-based config)

- **Config dir** (`~/.config/basalt/` or OS equivalent): connection configs +
  saved queries as TOML/JSON. Human-readable, diff-able, and directly usable as
  the git-sync repo.
- **Local SQLite:** query history only (searchable, re-runnable; kept out of
  git because it grows).
- **Secrets:** stored separately, never in the config dir. Model TBD.

---

## v1 Scope

### Included (P0)

| Area | Features |
|------|----------|
| Engines | PostgreSQL, MySQL/MariaDB, SQLite; TLS/SSL modes |
| Connections | Test button, read-only toggle, SSH tunnel |
| Browse | Schema tree (DBs, schemas, tables, columns, indexes, views) |
| Editor | Autocomplete, format, multi-tab, multi-statement, query history |
| Data | Inline grid CRUD (edit/insert/delete, commit/rollback) |
| DDL | Create / alter / drop tables & indexes |
| Import/Export | CSV/JSON export of results; CSV import into tables |
| Safety | Confirm destructive stmts; tx control; auto row-limit; query cancel |
| Teams | Git-sync of connection configs (no secrets) + saved queries |
| Theming | Preset color schemes (token-based) |
| Platforms | macOS, Windows, Linux |

### Build order (all within v1)

1. Connect + introspect + schema browse
2. SQL editor + run + history
3. Data grid CRUD
4. DDL
5. Import / export
6. Git-sync
7. Theming polish

### Deferred (post-v1)

- Additional engines (MSSQL, Oracle, MongoDB, …)
- ER diagrams, visual query builder
- AI / natural-language SQL
- Custom theme editor + custom CSS
- Plugins/extensions
- Server monitoring / DBA tooling (roles, vacuum, backups)

---

## Open questions

1. **Secret storage model** (deferred by user — decide before connections /
   git-sync ship). Candidates: OS keychain via `keyring` crate (secrets never
   synced); encrypted file + master password (syncable); or both. **Blocker**
   for the connections and git-sync milestones.

## Risks

- **Bundle size:** 3 DB drivers + rustls + SSH in one Rust binary may approach
  the 30 MB ceiling. Mitigate: size-optimized release profile (`opt-level="z"`,
  LTO, `strip`, `panic="abort"`), measure per-driver cost early, consider
  feature-flagging engines if needed.
- **Type-system breadth:** each engine's types must map cleanly to JSON for the
  grid; edge types (arrays, JSON, enums, geometry) need explicit handling.
