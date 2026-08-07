# Basalt DB Studio

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-v2-orange.svg)](https://v2.tauri.app)
[![Svelte](https://img.shields.io/badge/Svelte-v5-ff3e00.svg)](https://svelte.dev)
[![Rust](https://img.shields.io/badge/Rust-1.94%2B-000000.svg)](https://www.rust-lang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8.svg)](https://tailwindcss.com)

Basalt DB Studio is a lightweight, cross-platform, keyboard-driven database GUI for PostgreSQL, MySQL / MariaDB, and SQLite. Built with Tauri 2 (Rust backend) and Svelte 5 (runes), it delivers a dense, ultra-fast alternative to traditional database management tools.

---

## Quick Start: Running the App

### 1. Prerequisites
Ensure you have the following installed on your machine:
- Node.js: v20+ (v26+ recommended)
- pnpm: v10+ (npm install -g pnpm)
- Rust: 1.94+ (rustup update stable)
- Tauri Prerequisites: OS-specific C++ build tools / webkit2gtk (see Tauri Prerequisites Guide)

### 2. Installation
Clone the repository and install frontend dependencies:

```bash
git clone https://github.com/Chadgeaptuni/Basalt-DB-Studio.git
cd Basalt-DB-Studio
pnpm install
```

### 3. Development Commands

| Command | Description |
|---|---|
| `pnpm tauri dev` | Run the full desktop app (Vite frontend + Rust Tauri backend) |
| `pnpm dev` | Launch the frontend-only Vite dev server (for UI prototyping) |
| `pnpm check` | Run Svelte type-checking (`svelte-check`) and frontend unit tests (`vitest`) |
| `pnpm build` | Build production frontend bundle |
| `pnpm tauri build` | Build the standalone production desktop app binary and bundle |

### 4. Running Backend Tests & Lints

```bash
cd src-tauri
cargo clippy --all-targets -- -D warnings   # Run Rust strict linter
cargo fmt --check                            # Verify code formatting
cargo test                                   # Run all unit and integration tests
```

---

## Key Features

- **Lightweight & Size-Optimized**: Total installed bundle size remains strictly < 30 MB (release binary ~4–8 MB depending on platform).
- **Multi-Engine Database Support**: Native asynchronous drivers (`sqlx 0.9`) for PostgreSQL, MySQL / MariaDB, and SQLite.
- **Fast Schema Introspection & Explorer**: Grouped namespaces, tables, views, primary keys, indexes, and lazy-loaded column details.
- **Advanced SQL Editor (CodeMirror 6)**:
  - Dialect-specific SQL syntax highlighting.
  - Schema-aware autocompletion (tables, views, columns fed dynamically into CodeMirror).
  - Multi-statement script splitting and cursor-statement target execution.
  - One-click SQL formatting via `sql-formatter`.
- **Virtualized Data Grid**:
  - High-performance infinite row scrolling powered by `VirtualList`.
  - Type-aware cell rendering (`NULL` badges, numeric, JSON, UUID, hex previews for binary `bytea`/`BLOB`).
  - Real-time query execution metrics (duration in ms, row count, limit notices).
- **Interactive Data Editing (CRUD)**:
  - In-place grid editing with dirty cell tracking.
  - One-transaction batch commits (`INSERT`, `UPDATE`, `DELETE`).
  - Automatic identity resolution using Primary Keys or all-column fallback.
  - Safe rollback protection upon ambiguous row identity matches.
- **DDL Generator & Schema Management**:
  - Preview generated SQL DDL statements before executing destructive schema changes.
  - GUI dialogs for creating tables, adding/renaming columns, creating indexes, and dropping objects.
- **High-Throughput Import & Export**:
  - Memory-efficient streaming CSV and JSON exports over Tauri IPC channels (`ipc::Channel`).
  - RFC4180-compliant CSV import with per-engine conflict resolution (`ON CONFLICT DO NOTHING/UPDATE`, `INSERT IGNORE`, `INSERT OR IGNORE`) and line-accurate error reporting.
- **Zero-Trust Secret Hygiene**:
  - Connection TOML files store only a `secret_ref`. Passwords never touch disk configuration files or Git commits.
  - Memory-only password storage with OS Keychain / encrypted vault support.
- **Built-In Git Sync**:
  - Shells system `git` to sync connection profiles and saved queries seamlessly across workstations.
- **Flat Utilitarian Design System**:
  - Strict flat design with 1px borders, dense data density, zero gradients, zero Dribbble-style bloat.
  - Ships with 4 theme presets: `basalt-dark` (default), `basalt-light`, `basalt-nord`, and `basalt-paper`.

---

## Keyboard Shortcuts

Basalt DB Studio is designed to be fully operable without touching the mouse:

| Shortcut | Action |
|---|---|
| `Ctrl + Enter` (or `Cmd + Enter`) | Execute statement at cursor / active selection |
| `Ctrl + Shift + Enter` | Execute full SQL script |
| `Ctrl + Shift + F` | Format active SQL code |
| `Ctrl + T` | Open new SQL editor tab |
| `Ctrl + W` | Close current editor tab |
| `Ctrl + PgUp` / `Ctrl + PgDn` | Switch editor tabs |
| `Ctrl + S` | Save active query to saved queries repository |
| `Ctrl + B` | Toggle left sidebar (Connections & Schema Tree) |
| `Escape` | Cancel running query / close modal dialog |

---

## Technical Architecture

### Tech Stack Overview

```
+---------------------------------------------------------+
|                    Svelte 5 Frontend                    |
|   Vite · Tailwind CSS v4 · CodeMirror 6 · Lucide Icons   |
+────────────────────────────┬────────────────────────────+
                             | Tauri 2 IPC Channel / Commands
+────────────────────────────v────────────────────────────+
|                    Rust Backend (Tauri)                 |
|      sqlx 0.9 · Tokio Async · Serde · Thiserror         |
+──────┬─────────────────────┬─────────────────────┬──────+
       |                     |                     |
+──────v──────+       +──────v──────+       +──────v──────+
|  PostgreSQL |       | MySQL/Maria |       |   SQLite    |
+─────────────+       +─────────────+       +─────────────+
```

### Folder Structure

```
Basalt-DB-Studio/
├── src/                          # Svelte 5 Frontend
│   ├── app.css                   # Tailwind v4 configuration (@theme tokens)
│   ├── main.ts                   # Frontend entry point & theme initialization
│   ├── themes/                   # CSS variable token presets ([data-theme])
│   └── lib/
│       ├── api/                  # Tauri IPC command client wrappers & types
│       ├── components/           # Domain-specific Svelte components
│       │   ├── connections/      # Connection manager & forms
│       │   ├── ddl/              # Table designer & DDL preview modals
│       │   ├── editor/           # CodeMirror 6 SQL editor
│       │   ├── gitsync/          # Git synchronization bar
│       │   ├── grid/             # Virtualized data grid & CRUD view
│       │   ├── importExport/     # CSV/JSON import wizard & export runner
│       │   ├── schema/           # Introspection schema tree
│       │   ├── settings/         # App settings & theme picker
│       │   └── ui/               # Reusable UI primitives (Button, Modal, etc.)
│       ├── stores/               # Global state using Svelte 5 modules (.svelte.ts)
│       └── utils/                # Keymaps, cell display formatters, debouncers
├── src-tauri/                    # Rust Tauri 2 Backend
│   ├── capabilities/             # Tauri security permission capabilities
│   ├── src/
│   │   ├── commands/             # Thin #[tauri::command] handlers per domain
│   │   ├── config/               # TOML profiles, saved queries & settings
│   │   ├── drivers/              # Engine abstraction, value decode/bind, CRUD
│   │   ├── errors/               # Unified AppError enum & ErrorResponse mapping
│   │   ├── gitsync/              # System Git shell wrapper
│   │   ├── services/             # Core business logic (Connections, Query, Grid, DDL)
│   │   └── sqlgen/               # SQL lexer, splitter, classifier & DDL generator
│   └── tests/                    # Integration tests running against live DB containers
├── docker-compose.test.yml       # Integration test DB container definitions
└── docs/                         # Specifications & design documentation
```

---

## Testing & Quality Assurance

The codebase maintains strict quality gates and complete test coverage:

- **Frontend Checks**:
  ```bash
  pnpm check
  ```
  Runs `svelte-check` (verifying 0 errors/warnings) and `vitest` unit tests.

- **Backend Unit & Integration Tests**:
  ```bash
  cd src-tauri
  cargo test
  ```
  Integration tests validate live connection, introspection, schema description, CRUD operations, and error handling against PostgreSQL 16 and MySQL 8 containers defined in `docker-compose.test.yml`.

- **Bundle Size Enforcement**:
  ```bash
  node scripts/check-bundle-size.mjs
  ```
  Fails CI if the production bundle size exceeds 30 MB.

---

## License

This project is free software under the **GNU General Public License v3.0**. See the
[LICENSE](LICENSE) file for the full terms.

It comes with absolutely no warranty. You are welcome to redistribute it under the
terms of the GPL, and any derivative work must be released under the same licence.
