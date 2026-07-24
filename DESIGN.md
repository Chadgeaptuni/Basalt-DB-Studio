# Basalt DB Studio — UI/UX Design System & Frontend Architecture

This document is the **absolute source of truth** for all UI/UX design and Svelte
architecture in Basalt DB Studio. Read it before writing or editing any Svelte or
Tailwind code. On any conflict or ambiguity, this file governs.

**Aesthetic:** flat, dense, utilitarian, keyboard-driven. The reference family is
Linear / DataGrip / lazygit — a professional data tool, not a marketing site.
Every pixel earns its place; data is the interface.

---

## 1. The Anti-Slop Manifesto (zero tolerance)

AI models default to outdated "Dribbble-style" trends. The following are
**strictly forbidden** in this codebase:

- ❌ **No gradients.** No `bg-gradient-*`, no gradient text, no gradient borders.
- ❌ **No glassmorphism.** No `backdrop-blur`, no semi-transparent milky panels.
- ❌ **No shadows or glows.** No `shadow-*`, no neon box-shadows, no "elevation".
- ❌ **No colored card borders.** All borders are muted neutral (`--border`).
- ❌ **No arbitrary colors.** No hex/rgb/hsl literals in components — every color
  maps to a design token (§3). `text-[#8b5cf6]` is a build-blocking review failure.
- ❌ **No emoji in the UI.** Icons are Lucide, monochrome, sized deliberately.
- ❌ **No bouncy/delayed entry animations.** No fade-in-up cascades, no spring
  wobble, no staggered reveals. Simple transitions only (§7).
- ❌ **No hero empty states.** No centered illustrations with friendly copy filling
  a pane. Empty states are one line + one action, top-aligned like content (§8).
- ❌ **No skeleton-shimmer theater.** Local loads under ~150 ms render nothing;
  longer loads show a `Spinner` or a static placeholder row — never animated
  shimmer blocks approximating fake content.
- ❌ **No oversized padded cards** wrapping what should be a dense list or table row.
- ❌ **No generic error toasts.** "Something went wrong" is forbidden — every
  backend error `kind` renders a specific, actionable state (§8).

If proposed code contains `shadow-`, `bg-gradient-`, `backdrop-blur`, a color
literal, or any item above — **rewrite it before presenting it**.

## 2. Depth & Surface Model

Depth comes from **contrast and 1px borders**, never shadows.

- Three background levels, darkest to lightest (in dark themes):
  `--bg-0` (app base: editor, grid body) → `--bg-1` (panels: sidebar, results
  header, status bar) → `--bg-2` (raised: modals, menus, active tab, hover).
- Adjacent surfaces are separated by `1px` `--border` lines, not gaps or shadows.
- Lists use row separators (`divide-y` with `--border`) or plain hover highlight —
  not per-item cards.
- The accent color (`--accent`) is used **sparingly**: primary buttons, active/
  selected states, focused rings, the running-query indicator, connection-alive
  dots. If a screen is >5% accent-colored, it's wrong.

## 3. Design Tokens (the only source of color)

Tailwind v4, CSS-first. Utility-generating tokens are declared in `src/app.css`
under `@theme inline`, each mapping a raw CSS variable (`--bg-0`, …) into a
utility (`bg-bg-0`, …). The raw variables are computed per theme+variant in
`src/lib/stores/themeData.ts` and written onto `<html>` as inline
variables by `stores/theme.svelte.ts`. `src/themes/tokens.css` holds the
contract doc + a basalt-dark fallback (pre-JS / no-JS). **Adding a color = adding
a token to the contract and deriving it in `themeData.ts`**, never a literal.

Token contract (every preset must define all of these):

| Token | Role |
|---|---|
| `--bg-0` `--bg-1` `--bg-2` | Surface levels (§2) |
| `--fg-0` `--fg-1` `--fg-2` | Text: primary / secondary / muted-label |
| `--border` `--border-strong` | Hairlines / emphasized separators (focus-adjacent) |
| `--accent` `--accent-fg` | Accent surface + text on accent |
| `--danger` `--danger-fg` `--danger-bg` | Destructive text / on-danger / muted danger surface |
| `--ok` `--warn` | Success / warning indicators (dots, badges) |
| `--grid-header-bg` `--grid-row-alt` `--grid-sel` `--grid-null` `--grid-edited` | Data grid: header, zebra, selection, NULL badge, dirty-cell marker |
| `--syntax-kw` `--syntax-str` `--syntax-num` `--syntax-comment` `--syntax-fn` `--syntax-ident` | SQL editor highlighting (fed to the CodeMirror theme) |

Every theme is a seed in `themeData.ts` (4 house themes — `basalt-dark`
(default), `basalt-light`, `basalt-nord`, `basalt-paper` — plus the ported Flow
palettes: catppuccin, dracula, gruvbox, nord, tokyo-night, …). Each seed carries
a light and dark base palette; `themeTokens(seed, variant)` derives the full
contract above for all three variants — **light**, **dark**, and **amoled** (OLED
true-black). `stores/theme.svelte.ts` persists the theme + variant choice, sets
`data-theme`/`data-variant` on `<html>`, and applies the resolved tokens. Custom
themes are user-defined seeds. The theme editor only writes seed colors — zero
component rework.

## 4. Typography

Text contrast is the primary hierarchy tool. Two font stacks: UI sans and mono.

- **Panel/section titles:** `text-sm font-medium` `--fg-0`.
- **Body/labels:** `text-sm` `--fg-1`.
- **Overline labels** (sidebar groups, form sections): `text-xs uppercase
  tracking-wider font-medium` `--fg-2`.
- **All data is mono**, no exceptions: cell values, row counts, durations,
  connection hosts/ports, SQL text, keyboard shortcuts (`Kbd`), history entries.
  `font-mono` + `tabular-nums`.
- No `text-3xl` hero headings anywhere — this is a tool, dense by default.
  Largest UI text is `text-base` (modal titles).

## 5. Layout

- **App shell:** fixed left sidebar (connections + schema tree + saved queries) ·
  main area (editor tabs above, results grid below, both in a `SplitPane`) ·
  bottom `StatusBar` (connection, tx state, row count, duration, row-limit
  notice). All resizable panes use the shared `SplitPane` primitive.
- **Density first.** Prefer tables and dense flex rows over cards. Default
  control height is 28px (`h-7`), grid rows 28px, tree rows 24px, sidebar width
  ~260px. Padding steps: `p-1.5` inside rows, `p-3` for panel sections, `p-4`
  for modals — nothing larger.
- **Forms** (connection editor, table designer): single column, `label above
  input`, 12-col grid only when pairing short fields (host/port). No bento grids
  anywhere — this app is panes and tables.
- Wide content (grids, SQL previews) scrolls inside its own container
  (`overflow-auto`); the app shell itself never scrolls.

## 6. Component Blueprints

Every interactive element comes from `src/lib/components/ui/` — never restyle ad
hoc at a call site. Variants are props; if a needed variant is missing, **extend
the primitive**, don't fork it locally.

- **Radii:** controls & inputs `rounded-md` · menus, popovers & modals
  `rounded-lg` · badges/pills `rounded-full` · grid cells & tree rows `rounded-none`.
- **Button** — `variant: 'primary' | 'secondary' | 'ghost' | 'danger'`,
  `size: 'sm' | 'md'`, optional `icon`. Primary = `--accent`/`--accent-fg`;
  secondary = `--bg-2` + border; ghost = transparent, hover `--bg-2`; danger =
  `--danger-bg` surface + `--danger` text + danger border (muted, not alarm-red).
- **IconButton** — square ghost button for toolbars; `title` (tooltip) required.
- **Input / Select / Checkbox** — `--bg-0` field on `--bg-1` panels, 1px border,
  focus = accent ring (§7). Error state: danger border + `text-xs` danger message
  below; never a toast for field validation.
- **Badge** — `variant: 'neutral' | 'accent' | 'ok' | 'warn' | 'danger'`. Used
  for: `NULL` cells (`--grid-null`, italic mono), tx state (`TX` in status bar),
  read-only connections, engine tags (`PG` `MY` `SQ`).
- **Modal / ConfirmDialog** — centered, `max-w-md`/`max-w-lg`, `--bg-2`, 1px
  border, dimmed scrim (`--bg-0` at ~60% opacity, **no blur**). ConfirmDialog is
  invoked only via the global `confirm()` store (§9) — never instantiated inline.
- **Toast / ToastHost** — bottom-right stack, dense single-line rows with icon +
  message + optional action; auto-dismiss 4s (errors 8s, or sticky with action).
  Created only via the global `toast.*` API (§9).
- **ContextMenu / DropdownMenu** — `--bg-2`, 1px border, 24px rows, `Kbd` hints
  right-aligned, danger items use `--danger` text.
- **Tooltip** — delay 400 ms, `text-xs`, no arrow.
- **EmptyState** — icon (16px, `--fg-2`) + one sentence + at most one action.
- **Spinner** — 3 sizes; inline in buttons while pending (`Button` handles it via
  a `loading` prop).
- **VirtualList / TreeItem / Tabs / SplitPane / Kbd** — shared primitives; any
  scrolling data list must use `VirtualList` (§10).

## 7. Interaction & Keyboard

- **Every interactive element has hover + focus-visible states.** Hover =
  background shift to `--bg-2` via `transition-colors duration-150`. Focus =
  2px accent ring (`outline`), visible only via `:focus-visible`.
- **Simple transitions only — no fancy motion.** Allowed: `transition-colors`,
  `opacity`/fade, modal & menu fade-scale (≤120 ms), and short height/width slides
  for collapsing surfaces (accordion sections, tab open/close). All motion is
  100–150 ms with plain easing. **Forbidden:** spring/bounce, staggered or
  cascading reveals, fade-in-up hero entrances, skeleton shimmer, parallax, and
  anything over ~150 ms. Respect `prefers-reduced-motion` — it disables all of the
  above.
- **The app is fully keyboard-operable.** Core map (Cmd on macOS = Ctrl elsewhere):
  - `Ctrl+Enter` run statement at cursor / selection · `Ctrl+Shift+Enter` run whole script
  - `Ctrl+T` / `Ctrl+W` new / close editor tab · `Ctrl+PgUp/PgDn` switch tabs
  - `Ctrl+S` save query · `Ctrl+Shift+F` format SQL · `Escape` cancel running query / close overlay
  - `Ctrl+B` toggle sidebar · `Ctrl+K` command palette (if/when shipped)
  - Grid: arrows/Tab navigate, `Enter` edit cell, `Escape` revert cell, `Ctrl+Enter` commit pending edits, `Ctrl+C` copy cell/selection (TSV), `Ctrl+Shift+C` advanced copy (headers/delimiter/quoting)
  - Shortcuts live in `src/lib/utils/keyboard.ts` (single registry — no scattered
    `onkeydown` listeners) and are shown in menus/tooltips via `Kbd`.
- **Frictionless settings:** flat lists with visible controls; no accordions
  hiding core options.
- Destructive actions (`DROP`, `DELETE`/`UPDATE` without `WHERE`, `TRUNCATE`,
  row deletion, disconnect with open tx) always route through `confirm()` with a
  danger-variant dialog naming the object: "Drop table `users`?" — never a bare
  "Are you sure?".

## 8. States: loading, empty, error (all three, always)

Every view that renders backend data must define all three states explicitly.
A blank pane is a bug.

- **Loading:** <150 ms nothing; then `Spinner` (inline for panels, in the results
  toolbar for queries — the editor stays interactive; running queries show a
  cancel button + elapsed time in mono).
- **Empty:** `EmptyState` one-liner with the next action. Examples: no
  connections → "No connections yet" + [New connection]; empty result → "0 rows ·
  42 ms" in the results toolbar (not a giant pane message); empty table → grid
  header + "No rows" line + [Insert row].
- **Error:** switch on `ApiError.kind` — each kind has a specific rendering:
  - Connection kinds (`connectionRefused`, `authFailed`, `tlsError`,
    `tunnelError`) → inline state in the connection form / sidebar item with the
    engine message and a [Retry] / [Edit connection] action.
  - `queryError` → inline panel in the results area with the engine's message;
    when a position offset is present, underline the offending token in the editor.
  - `confirmationRequired` → never an error UI; it triggers `confirm()` and
    re-invokes with `confirmed: true` on acceptance.
  - `keychainUnavailable` / `vaultLocked` / `secretNotFound` → password prompt
    flow (memory-only fallback), with one explanatory line.
  - `gitConflict` / `gitDirty` / `gitNotInstalled` → git panel states with the
    exact next step ("Resolve conflicts in your git tool, then retry").
  - `readOnlyViolation`, `noPrimaryKey`, `ambiguousRowIdentity` → inline grid/
    toolbar notices explaining *why* editing is blocked.
  - Truly unexpected (`internal`) → error toast with the message and a "Copy
    details" action. This is the **only** kind allowed to toast generically.
- **Optimistic UI with rollback:** local-only actions (theme switch, settings
  toggles, staging grid edits) update rune state instantly; if the backend write
  fails, roll the state back and surface the specific error — never leave UI and
  disk out of sync.

## 9. Frontend Architecture (what may import what)

Strict layering; dependencies point downward only:

```
components/[domain]/  →  stores/  →  api/  →  (Tauri invoke)
components/ui/        →  (props/events only — nothing below)
```

- **`src/lib/components/ui/`** — dumb primitives. Props in, events out
  (callback props, not dispatchers). Never import stores, api, or domain
  components. Never fetch data. Zero business logic.
- **`src/lib/components/[domain]/`** — smart containers per domain
  (`connections`, `schema`, `editor`, `grid`, `ddl`, `importExport`, `gitsync`,
  `settings`, `layout`). They read/write stores, call api modules, compose `ui/`
  primitives.
- **`src/lib/stores/*.svelte.ts`** — global state as Svelte 5 runes modules
  (`$state`/`$derived` in `.svelte.ts`). Export an object with mutable
  properties or accessor functions — never a reassigned exported primitive
  (Svelte disallows it). No state-management library. Local component `$state`
  is only for ephemeral UI (open/closed, hover, draft text).
- **`src/lib/api/`** — the **only** place `invoke()` appears. `client.ts` wraps
  invoke, converts backend `ErrorResponse` into a typed `ApiError { kind,
  message, detail }` and throws it. `types.ts` mirrors the Rust wire types.
  One module per command domain. A component or store calling `invoke()`
  directly is a review failure.
- **Global singletons, declared once, reused everywhere:**
  - `stores/toasts.svelte.ts` → `toast.success|error|info(message, opts)`;
    rendered by one `ToastHost` mounted in `App.svelte`.
  - `stores/dialogs.svelte.ts` → `confirm(opts): Promise<boolean>`; rendered by
    one `ConfirmDialogHost` in `App.svelte`.
  - Re-implementing a toast, confirm, spinner overlay, or context menu at a call
    site is a bug — extend the primitive instead.
- **Svelte 5 idioms (current, not legacy):** runes (`$state`, `$derived`,
  `$effect`, `$props`, `$bindable`); snippets — not slots; `onclick` — not
  `on:click`; no event modifiers (call `preventDefault()` in the handler); no
  `createEventDispatcher`. Legacy syntax in new code is a review failure.

## 10. Performance Rules

- **Virtualize all unbounded lists** with the shared `VirtualList` (data grid
  rows, history, long schema trees). Never render N DOM rows for N data rows.
- **Zero IPC per keystroke.** Autocomplete reads the in-memory schema store
  (loaded on connect, refreshed after DDL). Search/filter inputs are debounced
  (`utils/debounce.ts`, 200 ms) before any backend call.
- **Pre-format once, render many:** grid cell display strings are computed once
  per fetch (`utils/cellDisplay.ts`), not in each cell render.
- **Lazy-load heavy code:** the SQL formatter and import wizard are dynamic
  `import()`s on first use. Lucide icons are imported per-icon, never the barrel.
- The editor must stay responsive while a query runs (all backend work is async;
  never `await` in a way that blocks typing or tab switching).

---

## Agent Execution Directive

Before presenting any UI code, self-check the diff for:

1. `shadow-`, `bg-gradient-`, `backdrop-blur`, blur scrims
2. Color literals (`#`, `rgb(`, `hsl(`, `oklch(`) outside `themes/` and `app.css`
3. `invoke(` outside `src/lib/api/`
4. Business logic, store imports, or fetching inside `components/ui/`
5. Legacy Svelte: `on:click`, slots, `createEventDispatcher`, `$:` statements
6. A view missing any of loading / empty / error states
7. Ad-hoc toast/confirm/spinner markup instead of the global services
8. A scrolling data list not using `VirtualList`

Any hit → **rewrite before presenting**. These are also review-blocking in PRs.
