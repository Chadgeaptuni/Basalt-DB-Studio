# Basalt DB Studio — UI/UX Design System & Frontend Architecture

This document is the **absolute source of truth** for all UI/UX design and Svelte
architecture in Basalt DB Studio. Read it before writing or editing any Svelte or
Tailwind code. On any conflict or ambiguity, this file governs.

**Aesthetic:** Material 3, applied to a dense professional data tool. The
reference implementation is the sibling project **Flow Desktop** — same role
tokens, same shape scale, same motion. Chrome is Material; the data grid is
Material's *dense* end of the scale, not a second design language.

---

## 1. Material 3 is the law

Basalt implements Material 3 — roles, shape, state layers, elevation, and motion —
not a house style that borrows from it. When a question is not answered here,
the answer is whatever M3 specifies, cross-checked against Flow Desktop.

**The five systems, all mandatory:**

1. **Colour roles (§3).** Every colour is an M3 role token. A component names the
   role it means (`bg-primary-container`, `text-on-surface-variant`), never a raw
   value and never a Tailwind palette colour.
2. **Shape (§2).** Radii come from the M3 shape scale only: `rounded-xs` 4px ·
   `rounded-sm` 8px · `rounded-md` 12px · `rounded-lg` 16px · `rounded-xl` 28px ·
   `rounded-full`. No arbitrary radius, no `rounded` bare.
3. **State layers (§7).** Interaction is a translucent overlay of the *content*
   colour over the container: hover 8%, focus/pressed 10% — `hover:bg-on-surface/8`,
   or `hover:bg-primary/8` on primary-coloured content. Never a hand-picked
   hover colour, never an opacity change on the whole control.
4. **Elevation (§2).** Depth is the tonal surface ladder. `shadow-e1/e2/e3` exist
   and are used **only** by floating containers that escape the layout — dialog,
   menu, snackbar, dropdown. A panel, card, row, or toolbar never carries a shadow.
5. **Motion (§7).** `transition-* duration-200 ease-standard` is the default for
   everything. Entrances use `ease-emphasized`. No spring, no bounce, no stagger.

**Still forbidden** (these are M3 violations too, not leftovers from an older doc):

- ❌ **No gradients.** M3 surfaces are flat tonal fills. No `bg-gradient-*`.
- ❌ **No glassmorphism.** No `backdrop-blur`, no milky translucent panels.
- ❌ **No arbitrary colours.** No hex/rgb/hsl literal in a component — every colour
  is a role token (§3). `text-[#8b5cf6]` is a build-blocking review failure.
- ❌ **No arbitrary radii or shadows.** `rounded-[7px]`, `shadow-lg`,
  `shadow-primary/20` are all failures — the scale in §4 and the three elevation
  tokens are the complete set.
- ❌ **No emoji in the UI.** Icons are Lucide, monochrome, sized deliberately.
- ❌ **No skeleton-shimmer theater.** Loads under ~150 ms render nothing; longer
  loads show a `Spinner` or a static placeholder row.
- ❌ **No generic error toasts.** "Something went wrong" is forbidden — every
  backend error `kind` renders a specific, actionable state (§8).

If proposed code contains `bg-gradient-`, `backdrop-blur`, a colour literal, an
off-scale radius, or a shadow on a non-floating element — **rewrite it before
presenting it**.

**Single exception — the brand mark.** `public/icon.svg`, `public/icon-mark.svg`,
and the icons generated from them (`src-tauri/icons/`) are brand assets, not UI:
they carry their own fixed palette and gradients and are exempt from the color
token and no-gradient rules. The exemption covers those files only — it never
extends to components that render them, and no other SVG or component may embed
literal colors on the grounds of being "logo-like".

## 2. Depth & Surface Model

Depth is M3's **tonal surface ladder**. A container is raised by moving up the
ladder, not by a shadow. Shadows exist for one job only: telling the user that a
container is *floating over* the layout rather than part of it.

| | Raised by | Example |
|---|---|---|
| In-layout surface | Tonal ladder + 1px `--outline-variant` | sidebar, results header, card, toolbar |
| Floating container | Tonal ladder + `shadow-e2` | dialog, menu, dropdown, snackbar |

`shadow-e1/e2/e3` are the complete set. `shadow-e2` covers almost everything;
`e3` is for a dialog over another dialog. Any `shadow-*` on an in-layout element
is a review failure.

- Five surface levels, base → most raised (in dark themes):
  `--surface` (app base: editor, grid body) → `--surface-container-low` (inset
  wells: search fields, sunken toolbars) → `--surface-container` (panels: sidebar,
  results header, status bar) → `--surface-container-high` (raised: modals, menus,
  active tab, hover) → `--surface-container-highest` (hover *on* a raised surface:
  menu rows, modal list rows).
- Reach for a new level only when two surfaces genuinely stack. A flat screen
  using two levels is correct; using all five to look layered is not.

### Shape scale

The M3 scale is declared once in `app.css` and overrides Tailwind's defaults, so
`rounded-md` *is* M3 medium. These are the only radii in the app:

| Utility | Size | Used by |
|---|---|---|
| `rounded-xs` | 4px | badge, `Kbd`, cell-level affordances, tag |
| `rounded-sm` | 8px | text field, select, button, tree row, list row |
| `rounded-md` | 12px | card, panel section, context menu, dropdown |
| `rounded-lg` | 16px | dialog, modal, snackbar |
| `rounded-xl` | 28px | full-height sheet, large surface (rare) |
| `rounded-full` | — | icon button, chip, avatar, status dot, spinner |

The data grid is the one deliberate exception: cells and grid rows are square
(`rounded-none`). M3's own dense/data guidance keeps tabular cells rectangular —
rounding a 24px row wastes horizontal space and breaks the column rhythm.
- Adjacent surfaces are separated by `1px` `--outline-variant` lines, not gaps.
- Lists use row separators (`divide-y` with `--outline-variant`) or a state-layer
  hover — not per-item cards.
- `--primary` is used **sparingly**: filled buttons, selected states, focus rings,
  the running-query indicator, connection-alive dots. Tonal surfaces
  (`--primary-container`, `--secondary-container`) carry the softer cases —
  selected rows, active tabs, chips. If a screen is >5% full-strength primary,
  it's wrong.

## 3. Design Tokens (the only source of color)

Tailwind v4, CSS-first. Utility-generating tokens are declared in `src/app.css`
under `@theme inline`, each mapping a raw CSS variable (`--surface`, …) into a
utility (`bg-surface`, …). The raw variables are computed per theme in
`src/lib/stores/themeData.ts` and written onto `<html>` as inline
variables by `stores/theme.svelte.ts`. `src/themes/tokens.css` holds the
contract doc + a basalt-dark fallback (pre-JS / no-JS). **Adding a color = adding
a token to the contract and deriving it in `themeData.ts`**, never a literal.

Token contract (every preset must define all of these):

| Token | Role |
|---|---|
| `--surface` `--surface-container-low` `--surface-container` `--surface-container-high` `--surface-container-highest` | Surface levels (§2) |
| `--on-surface` `--on-surface-variant` `--on-surface-muted` | Text: primary / secondary / muted-label |
| `--outline-variant` `--outline` | Hairlines / emphasized separators (focus-adjacent) |
| `--primary` `--on-primary` | Filled primary surface + text on it |
| `--primary-container` `--on-primary-container` | Tonal primary: filled-tonal buttons, selected rows, assist chips |
| `--secondary-container` `--on-secondary-container` | Neutral tonal: active tab, toggled icon button, hovered menu row |
| `--error` `--on-error` `--error-container` `--on-error-container` | Destructive: text, on-error, tonal error surface, text on it |
| `--ok` `--warn` | Success / warning indicators (dots, badges) |
| `--grid-header-bg` `--grid-row-alt` `--grid-sel` `--grid-null` `--grid-edited` | Data grid: header, zebra, selection, NULL badge, dirty-cell marker |
| `--syntax-kw` `--syntax-str` `--syntax-num` `--syntax-comment` `--syntax-fn` `--syntax-ident` | SQL editor highlighting (fed to the CodeMirror theme) |

Colors live as *seeds* in `themeData.ts` (house families — `basalt`,
`basalt-nord`, `basalt-paper` — plus the ported Flow palettes: catppuccin,
dracula, gruvbox, tokyo-night, …). Each seed carries a light and a dark base
palette, and `THEME_ENTRIES` flattens every seed into one selectable theme per
authored appearance (`<seed>-light`, `<seed>-dark`) plus the single true-black
`basalt-oled` preset. A theme is therefore one fixed appearance — there is no
global light/dark switch layered on top; the top bar's toggle just swaps to the
other appearance of the same family. `themeTokens(seed, category)` derives the
full contract above, `stores/theme.svelte.ts` persists the selected id, sets
`data-theme` and `color-scheme` on `<html>`, and applies the resolved tokens.
Custom themes are user-defined seeds, filed under Light or Dark by their authored
surface. The theme editor only writes seed colors — zero component rework.

## 4. Typography

Text contrast is the primary hierarchy tool. Two font stacks: UI sans and mono.

- **Panel/section titles:** `text-sm font-medium` `--on-surface`.
- **Body/labels:** `text-sm` `--on-surface-variant`.
- **Overline labels** (sidebar groups, form sections): `text-xs uppercase
  tracking-wider font-medium` `--on-surface-muted`.
- **All data is mono**, no exceptions: cell values, row counts, durations,
  connection hosts/ports, SQL text, keyboard shortcuts (`Kbd`), history entries.
  `font-mono` + `tabular-nums`.
- No `text-3xl` hero headings anywhere — this is a tool, dense by default.
  Largest UI text is `text-base` (modal titles).

## 5. Layout

- **App shell:** `TopBar` (Basalt mark left · connection switcher centred ·
  appearance/settings right, in a three-column grid so the centre stays centred) ·
  fixed left sidebar (schema tree + saved queries) · main area (editor tabs above,
  results grid below, both in a `SplitPane`) · bottom `StatusBar` (tx state, row
  count, duration, row-limit notice, zoom). The connection lives in the top bar
  and appears nowhere else; the status bar carries per-run state only. All
  resizable panes use the shared `SplitPane` primitive.
- **Density first.** Prefer tables and dense flex rows over cards. Default
  control height is 28px (`h-7`), grid rows 28px, tree rows 24px, sidebar width
  ~260px. Padding steps: `p-1.5` inside rows, `p-3` for panel sections, `p-4`
  for modals — nothing larger.
- **Forms** (connection editor, table designer): single column, `label above
  input`, 12-col grid only when pairing short fields (host/port). No bento grids
  anywhere — this app is panes and tables.
- Wide content (grids, SQL previews) scrolls inside its own container
  (`overflow-auto`); the app shell itself never scrolls.
- **Scrollbars are declared once, globally** in `app.css` — a 10px gutter whose
  thumb renders 6px (transparent border + `background-clip: padding-box`),
  `rounded-full`, transparent track, `--outline` resting → `--on-surface-muted`
  hover → `--primary` while dragging. No component styles its own scroller and
  no scroller is hidden: `scrollbar-width: none` and `::-webkit-scrollbar {
  display: none }` are review failures — a pane that scrolls must say so.

## 6. Component Blueprints

Every interactive element comes from `src/lib/components/ui/` — never restyle ad
hoc at a call site. Variants are props; if a needed variant is missing, **extend
the primitive**, don't fork it locally.

- **Button** — the M3 button family, one prop:
  `variant: 'filled' | 'tonal' | 'outlined' | 'text' | 'danger'`, `size: 'sm' | 'md'`,
  `rounded-full` (M3 buttons are pills). Filled = `--primary`/`--on-primary`;
  tonal = `--primary-container`/`--on-primary-container`; outlined = transparent +
  1px `--outline`; text = transparent, state layer only; danger =
  `--error-container`/`--on-error-container`. `Button` owns the state layer — call
  sites never add hover classes.
- **IconButton** — `rounded-full`, `place-items-center`, state layer on hover
  (Flow's `grid h-9 w-9 place-items-center rounded-full` idiom). `title` required
  (doubles as `aria-label`). Toggled state = `--secondary-container` fill.
- **Input / Select / Checkbox** — M3 **outlined text field**: `rounded-sm`, 1px
  `--outline-variant` resting → `--primary` 2px on focus, label `text-xs`
  `--on-surface-variant`. Error: `--error` border + `text-xs` `--error` message
  below; never a toast for field validation.
- **Badge / Chip** — `rounded-full`. `variant: 'neutral' | 'primary' | 'ok' | 'warn' | 'error'`.
  Neutral = `--secondary-container`; primary = `--primary-container`; error =
  `--error-container`. Used for: `NULL` cells (`--grid-null`, italic mono), tx
  state (`TX`), read-only connections, engine tags (`PG` `MY` `SQ`).
- **Modal / ConfirmDialog** — M3 dialog: centered, `max-w-md`/`max-w-lg`,
  `rounded-lg`, `--surface-container-high`, `shadow-e3`, scrim `--surface` at 60%
  (**no blur**). Actions bottom-right, text/tonal buttons. ConfirmDialog is invoked
  only via the global `confirm()` store (§9) — never instantiated inline.
- **Toast / ToastHost** — M3 **snackbar**: bottom-left stack, `rounded-sm`,
  `--surface-container-highest`, `shadow-e2`, single line + optional text action;
  auto-dismiss 4s (errors 8s, or sticky with action). Created only via the global
  `toast.*` API (§9).
- **ContextMenu / DropdownMenu** — M3 menu: `rounded-md`,
  `--surface-container-high`, `shadow-e2`, 32px rows with a state-layer hover,
  `Kbd` hints right-aligned, destructive items use `--error` text.
- **Tooltip** — delay 400 ms, `text-xs`, no arrow.
- **EmptyState** — icon (16px, `--on-surface-muted`) + one sentence + at most one action.
- **Spinner** — 3 sizes; inline in buttons while pending (`Button` handles it via
  a `loading` prop).
- **Kbd** — takes a shortcut spec (`"mod+shift+f"`), never pre-rendered key text,
  and emits one 16px `<kbd>` per key inside a grouping `<kbd>` — so a chord reads
  as separate caps and platform labels come from the one catalogue (§7).
- **VirtualList / TreeItem / Tabs / SplitPane** — shared primitives; any scrolling
  data list must use `VirtualList` (§10).

## 7. Interaction & Keyboard

### State layers (M3)

Interaction is expressed as a **translucent layer of the content colour over the
container**, never as a swapped-in background colour and never as opacity on the
control itself.

| State | Layer | Written as |
|---|---|---|
| Hover | content colour @ 8% | `hover:bg-on-surface/8` |
| Focus / pressed | content colour @ 10% | `focus-visible:bg-on-surface/10` |
| Hover on primary content | primary @ 8% | `hover:bg-primary/8` |
| Disabled | 38% content, no layer | `disabled:opacity-38` |

Filled buttons are the exception M3 makes: their state layer is `on-primary` over
`primary`, so they use `hover:brightness-110`-free overlays via a `::before` layer
or the `secondary-container` fallback — in this codebase `Button` owns that and no
call site reimplements it.

Focus is **additionally** a 2px `--primary` ring via `:focus-visible` (app.css
`@layer base`). State layer and focus ring coexist; neither replaces the other.

### Motion

- Default: `transition-* duration-200 ease-standard` — matches Flow Desktop's
  `transition-colors duration-200 ease-out` idiom and M3's standard easing.
- Entrances (dialog, menu, snackbar): `ease-emphasized`, ≤300 ms, fade + a small
  scale or slide. No spring, no bounce, no stagger, no parallax.
- **Forbidden:** cascading/staggered reveals, fade-in-up hero entrances, skeleton
  shimmer, anything over 300 ms.
- `prefers-reduced-motion` disables all of it (already enforced globally in
  `app.css`).
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
2. Color literals (`#`, `rgb(`, `hsl(`, `oklch(`) outside `themes/`, `app.css`,
   and the brand-mark SVGs (§1 exception)
3. `invoke(` outside `src/lib/api/`
4. Business logic, store imports, or fetching inside `components/ui/`
5. Legacy Svelte: `on:click`, slots, `createEventDispatcher`, `$:` statements
6. A view missing any of loading / empty / error states
7. Ad-hoc toast/confirm/spinner markup instead of the global services
8. A scrolling data list not using `VirtualList`

Any hit → **rewrite before presenting**. These are also review-blocking in PRs.
