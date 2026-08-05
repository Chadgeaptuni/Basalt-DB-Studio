# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Backend and full-stack developers are the core user: someone mid-task in an
editor who needs to query, inspect, or fix an application database without
leaving a keyboard-driven flow. They reach for Basalt instead of a heavyweight
Java GUI (DBeaver, pgAdmin) or a terminal client.

Small teams are the second-order audience, reached through git-sync — shared
connection profiles and saved queries in a repo. Team use is an extension of
individual use, not the entry hook.

## Product Purpose

An open-source, cross-platform desktop database GUI for PostgreSQL,
MySQL/MariaDB, and SQLite. Query editing and schema administration in one app.
Success is a developer choosing it over the incumbent GUI for daily work because
it launches fast, stays out of the way, and never requires the mouse.

## Positioning

Two claims a neighboring product could not truthfully copy:

1. **A hard 30 MB installed-bundle ceiling, enforced in CI**
   (`scripts/check-bundle-size.mjs`), while still feeling finished rather than
   stripped. The constraint can veto features and dependencies.
2. **Git-sync as the team primitive.** The config directory *is* a plain-file git
   repo. Connection profiles carry a `secret_ref` UUID and no password field —
   secrets cannot leak into git by construction, not by convention.

## Operating Context

- Desktop app (Tauri 2 webview), macOS 13+ / Windows 11 / Linux with
  webkit2gtk 4.1. Single window, no routing.
- Used alongside an editor and a terminal, often mid-debugging against a local or
  staging database; SSH tunnel / bastion access is part of the real path.
- Work products that leave the app: CSV/JSON exports, CSV imports, saved queries
  and connection profiles committed to a team repo.
- No telemetry of any kind. Outbound network is limited to the user's own
  database connections, their own git remote, and the signed update check.

## Capabilities and Constraints

Shipped and verified: connect + introspect + browse for all three engines;
SQL editor with schema-aware autocomplete; virtualized results grid with
per-statement tabs; editable table-data view with transactional commit and
no-primary-key fallback; DDL generation with preview-before-execute; streaming
CSV/JSON export and CSV import with per-engine conflict modes; manual git-sync
of config and saved queries; settings persistence and theme presets.

Not yet shipped: the secrets slice (OS keychain + encrypted-file vault,
auto-prompt on `authFailed`, TLS-ladder and SSH UI), plus pinned-transaction
connections, query cancellation, and statement timeout.

Terminology: *connection profile* (TOML, no secrets), *secret_ref* (UUID
pointing at the keychain/vault entry), *session*, *saved query*, *git-sync*.

Every user-facing failure mode has a distinct error `kind` the UI switches on —
there is no generic error path, by design.

## Brand Commitments

- Name: Basalt DB Studio. MIT licensed, open source.
- The brand mark (`public/icon.svg`, `public/icon-mark.svg`, and the generated
  `src-tauri/icons/`) carries its own fixed palette and is exempt from the UI
  color rules. The exemption covers those files only.
- Reference family for the interface: professional data tools (Linear,
  DataGrip, lazygit) — a tool, not a marketing site.
- Material 3 is adopted at the **colour-role layer only** — surface-container
  ladder, `on-surface` pairing, `outline`/`outline-variant` — shared with the
  sibling project Flow Desktop so both apps speak one token vocabulary. Material's
  visual language (elevation shadows, ripples, generous radii, tonal tints) is
  explicitly **not** adopted; DESIGN.md §1 governs.

## Evidence on Hand

Real, citable: the codebase and its test suite (72 backend tests run against
real postgres:16 and mysql:8 via `docker-compose.test.yml`; frontend
svelte-check clean + vitest); the enforced 30 MB bundle ceiling.

Must never be fabricated:

- **No users, adoption numbers, testimonials, case studies, or customer logos.**
  The project is pre-release (v0.1.0).
- **No performance benchmarks** against DBeaver, Beekeeper, or pgAdmin. The only
  measured claim is the bundle-size ceiling.
- **No pricing, paid tier, hosted service, or telemetry.** None exist.

## Product Principles

1. **Keyboard-complete before anything else.** If an action needs the mouse, the
   design is unfinished.
2. **Weight is a feature.** Every dependency and feature is measured against the
   30 MB ceiling; the standard library or ~100 lines of our own code beats a
   crate that drags a tree.
3. **Secrets are structurally impossible to leak**, not carefully handled.
4. **Data is the interface.** Density and legibility of real rows outrank
   expression; chrome recedes.
5. **Every failure is specific.** Each error kind gets its own actionable
   rendering — no collapsed generic states.

## Accessibility & Inclusion

Binding: **keyboard-complete** — every action reachable and discoverable without
a pointer, including grid editing, tree navigation, and modals. Theme token
palettes must hold contrast at WCAG AA.

Not established: full WCAG 2.2 AA conformance, including screen-reader semantics
for the virtualized grid. Recorded as undecided rather than claimed.
