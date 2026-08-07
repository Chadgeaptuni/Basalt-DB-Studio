# Basalt DB Studio — UI/UX Design System & Frontend Architecture

This document is the **absolute source of truth** for all UI/UX design and Svelte
architecture in Basalt DB Studio. Read it before writing or editing any Svelte or
Tailwind code. On any conflict or ambiguity, this file governs.

**Aesthetic:** Material 3 **at desktop density −2**, applied to a professional
data tool. The reference implementation is the sibling project **Flow Desktop** —
same role tokens, same shape scale, same motion. Chrome is Material; the data
grid is Material's *dense* end of the scale, not a second design language.

> **Migration in progress.** The M3 UI overhaul
> ([spec](docs/superpowers/specs/2026-08-06-m3-ui-overhaul.md)) is rebuilding the
> frontend against this document across milestones U0–U6. **This file describes
> the target, and governs all new and edited code** — where existing code
> disagrees, the code is wrong and the spec names the milestone that fixes it.
> Systems owned by each milestone: type/density/shape/state/motion + `ui/`
> primitives → U0 · shell and navigation → U1 · search → U2 · workspace → U3 ·
> data grid → U4 · dialogs and flows → U5.

---

## 1. Material 3 is the law

Basalt implements Material 3 — roles, shape, type, density, state layers,
elevation and motion — not a house style that borrows from it. When a question is
not answered here, the answer is whatever M3 specifies, cross-checked against
Flow Desktop.

**Density is the one place we diverge, and M3 sanctions it.** M3 defines density
tiers for desktop, each step −4dp. Basalt runs at **−2**. That is a *tier
selection*, not a licence to shrink individual components below it: shape, type,
state layers and motion are implemented at full fidelity. "It's a dense tool" has
been used to justify 4px radii and hand-picked text sizes — it does not.

**The seven systems, all mandatory:**

1. **Colour roles (§3).** Every colour is an M3 role token. A component names the
   role it means (`bg-primary-container`, `text-on-surface-variant`), never a raw
   value and never a Tailwind palette colour.
2. **Shape (§2).** Radii come from the M3 shape scale only: `rounded-xs` 4px ·
   `rounded-sm` 8px · `rounded-md` 12px · `rounded-lg` 16px · `rounded-xl` 28px ·
   `rounded-full`. No arbitrary radius, no `rounded` bare. **Dialogs are 28px** —
   the strongest single M3 cue in the app.
3. **Type scale (§4).** Text uses a named role utility — `text-title-md`,
   `text-body-sm`, `text-label-lg`, `text-data`. A raw `text-xs`, `text-sm` or
   `text-[11px]` in a component is a review failure.
4. **Density (§5).** One tier, everywhere: 56px dialog headers and rail items ·
   40px title bar, toolbars and tab strips · 36px rows · 32px controls · 28px
   dense controls. The data grid row is the one exemption at 28px.
5. **State layers (§7).** Interaction is a translucent overlay of the *content*
   colour over the container: hover 8%, focus/pressed 10%. Components import
   `stateLayer` or `stateLayerPill` from `ui/stateLayer.ts` — never a hand-picked
   hover colour, never an opacity change on the whole control.
6. **Elevation (§2).** Depth is the tonal surface ladder. `shadow-e1/e2/e3` exist
   and are used **only** by floating containers that escape the layout — dialog,
   menu, snackbar, dropdown, side sheet. A panel, card, row, or toolbar never
   carries a shadow.
7. **Motion (§7).** `transition-* duration-200 ease-standard` is the default for
   everything. Entrances use `ease-emphasized`. No spring, no bounce, no stagger.

**Still forbidden** (these are M3 violations too, not leftovers from an older doc):

- ❌ **No gradients.** M3 surfaces are flat tonal fills. No `bg-gradient-*`.
- ❌ **No glassmorphism.** No `backdrop-blur`, no milky translucent panels.
- ❌ **No arbitrary colours.** No hex/rgb/hsl literal in a component — every colour
  is a role token (§3). `text-[#8b5cf6]` is a build-blocking review failure.
- ❌ **No arbitrary radii or shadows.** `rounded-[7px]`, `shadow-lg`,
  `shadow-primary/20` are all failures — the shape scale in §2 and the three
  elevation tokens are the complete set.
- ❌ **No ad-hoc text sizes.** `text-xs`, `text-[11px]`, `text-sm` in a component
  are failures — name the type role (§4).
- ❌ **No hand-written hover states.** `hover:bg-surface-container/60`,
  `hover:border-outline`, `hover:text-primary` are failures — use the state layer
  (§7).
- ❌ **No off-tier sizing.** A control at `h-6` or `h-11` is a failure — the
  density tier in §5 is the complete set, and the data grid row is its only
  exemption. The tier governs rows, controls and bars; it does not govern icon
  glyph boxes (`h-4` chevron slots, badge caps), which size to their content.
- ❌ **No emoji in the UI.** Icons are Lucide, monochrome, sized deliberately.
- ❌ **No skeleton-shimmer theater.** Loads under ~150 ms render nothing; longer
  loads show a `Spinner` or a static placeholder row.
- ❌ **No generic error toasts.** "Something went wrong" is forbidden — every
  backend error `kind` renders a specific, actionable state (§8).

If proposed code contains `bg-gradient-`, `backdrop-blur`, a colour literal, an
off-scale radius, a raw text size, a hand-written hover, or a shadow on a
non-floating element — **rewrite it before presenting it**.

**Single exception — the brand mark's asset files.** `public/icon.svg`,
`public/icon-mark.svg`, and the icons generated from them (`src-tauri/icons/`)
carry their own fixed palette and are exempt from the color token and
no-gradient rules. They are what the *OS* renders — taskbar, installer, favicon
— where there is no theme to read, so a fixed palette is the only option.

**The mark inside the app is not one of them.** It is `BrandMark.svelte`, an
inline SVG drawn in `currentColor` and `--primary` and nothing else, so it
repaints with the theme like every other pixel. Rendering the asset in-app is
the failure this replaced: its near-white top face disappeared into any light
theme. The exemption covers those three asset paths only — no other SVG or
component may embed literal colors on the grounds of being "logo-like".

## 2. Depth & Surface Model

Depth is M3's **tonal surface ladder**. A container is raised by moving up the
ladder, not by a shadow. Shadows exist for one job only: telling the user that a
container is *floating over* the layout rather than part of it.

| | Raised by | Example |
|---|---|---|
| In-layout surface | Tonal ladder + 1px `--outline-variant` | nav rail, panel, results header, card, toolbar |
| Floating container | Tonal ladder + `shadow-e2` | dialog, menu, dropdown, snackbar, side sheet |

`shadow-e1/e2/e3` are the complete set. `shadow-e2` covers almost everything;
`e3` is for a dialog over another dialog. Any `shadow-*` on an in-layout element
is a review failure.

The values live on `--elevation-1/2/3` in `app.css`'s `@layer base`, and
`@theme inline` maps `--shadow-e*` onto them. Anything that builds its own
stylesheet and so cannot use a Tailwind utility — the CodeMirror theme — reads
`var(--elevation-N)` rather than restating the numbers.

- Five surface levels, base → most raised (in dark themes):
  `--surface` (app base: editor, grid body) → `--surface-container-low` (inset
  wells: search fields, sunken toolbars) → `--surface-container` (panels: nav
  rail, side panel, results header, status bar) → `--surface-container-high`
  (raised: dialogs, menus, side sheet, active tab) →
  `--surface-container-highest` (hover *on* a raised surface: menu rows, dialog
  list rows, tooltip).
- Reach for a new level only when two surfaces genuinely stack. A flat screen
  using two levels is correct; using all five to look layered is not.

### Shape scale

The M3 scale is declared once in `app.css` and overrides Tailwind's defaults, so
`rounded-md` *is* M3 medium. These are the only radii in the app:

| Utility | Size | Used by |
|---|---|---|
| `rounded-xs` | 4px | `Kbd`, badge interior, cell-level affordances |
| `rounded-sm` | 8px | text field, select, inline code block |
| `rounded-md` | 12px | card, panel section, menu, dropdown, side sheet |
| `rounded-lg` | 16px | large panel, snackbar |
| `rounded-xl` | 28px | **dialog / modal** |
| `rounded-full` | — | button, icon button, chip, **list & tree row state layer**, avatar, status dot, spinner |

Two assignments carry most of the M3 read and are easy to get wrong:

- **Dialogs are 28px**, at every density. M3 never shrinks the dialog corner.
- **A row's hover is a `rounded-full` pill inset 4px from the row edge**, not a
  full-bleed rectangle. This is the M3 list/navigation idiom, and it is what
  makes a tree read as Material rather than as a table.

The data grid is the one deliberate exception: cells and grid rows are square
(`rounded-none`). M3's own dense/data guidance keeps tabular cells rectangular —
rounding a 28px row wastes horizontal space and breaks the column rhythm.
- Adjacent surfaces are separated by `1px` `--outline-variant` lines, not gaps —
  but a hairline is not a substitute for the tonal ladder. If two stacked
  surfaces differ only by a border, one of them is on the wrong ladder level.
- Lists use row separators (`Divider`) or a state-layer hover — not per-item
  cards.
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

Colors live as *seeds* in `themeData.ts` (house families — `basalt-dark`,
`basalt-light`, `basalt-nord`, `basalt-paper` — plus the ported Flow palettes:
catppuccin, dracula, gruvbox, tokyo-night, …). Each seed carries a light and a
dark base palette.

**Theme and variant are two independent choices.** The selected *theme* is a
palette; the selected *variant* is one of `light` / `dark` / `amoled`, applied
globally. `themeTokens(seed, variant)` derives the full contract above;
`stores/theme.svelte.ts` persists both, sets `data-theme`, `data-variant` and
`color-scheme` on `<html>`, and applies the resolved tokens before first paint.
AMOLED builds on the dark palette with true-black surfaces. Custom themes are
user-defined seeds that render as authored at any variant (AMOLED still blackens
them), classified Light or Dark by their authored surface. The theme editor only
writes seed colors — zero component rework.

**No palette may ship unreadable text.** Every foreground token passes through
`readable()` in `themeData.ts`, which measures it against each surface it is
actually drawn on and, only if it falls under WCAG AA (4.5:1), walks it the
shortest distance toward black or white that clears the bar. A palette that was
authored legibly is returned untouched, so themes keep their identity; the ones
that were not — mostly the light variants of borrowed palettes, whose accents
were authored for a dark background — get the minimum correction.
`themeContrast.test.ts` asserts the whole matrix (22 palettes × 3 variants) and
is the gate: a new seed that fails it does not land. `--outline` is the single
deliberate exception, because it is a 1px hairline and not text — forcing 4.5:1
onto it would turn every panel edge into a hard border and undo §2.

The measuring itself is `utils/contrast.ts`, which resolves the two colour forms
the contract emits (`#rrggbb` and nested `color-mix(in srgb, …)`) and computes
WCAG ratios. The custom-theme editor reads it live, since a hand-picked palette
is the one case the audit suite can never see in advance.

## 4. Typography

Text contrast is the primary hierarchy tool. Two font stacks: UI sans and mono.

**The type scale is nine named roles**, declared once in `app.css` under `@theme`
so Tailwind generates the utilities. A component names a role; it never picks a
size. This is what stops `text-[11px]` and `text-[10px]` from reappearing.

| Role | Size / weight | Utility | Used by |
|---|---|---|---|
| title-large | 18 / 500 | `text-title-lg` | dialog headline |
| title-medium | 16 / 500 | `text-title-md` | panel title, modal section |
| title-small | 14 / 500 | `text-title-sm` | section heading, tab label |
| body-medium | 14 / 400 | `text-body-md` | default body text |
| body-small | 12 / 400 | `text-body-sm` | secondary text, blurbs |
| label-large | 14 / 500 | `text-label-lg` | button label |
| label-medium | 12 / 500 | `text-label-md` | chip, menu row, list row |
| label-small | 11 / 500 | `text-label-sm` | overline, grid type row, `Kbd` |
| data | 12 / 400 mono | `text-data` | every cell, count, duration, host |

- **All data is mono**, no exceptions: cell values, row counts, durations,
  connection hosts/ports, SQL text, keyboard shortcuts (`Kbd`), history entries.
  `text-data` carries `font-mono` + `tabular-nums` so call sites don't restate it.
- **Overline labels** (panel groups, form sections) are `text-label-sm uppercase
  tracking-wider` `--on-surface-muted`.
- No hero headings anywhere — this is a tool. Largest UI text is `text-title-lg`
  (dialog headlines).

## 5. Layout

- **App shell:** **title bar** (Basalt mark · centred search/command entry ·
  appearance · window controls) · **navigation rail** on the left (Schema ·
  Queries · History · Git, with Settings in a trailing group) · one **full-height
  panel** for the rail's active destination · main workspace (editor tabs above,
  results below, both in a `SplitPane`) · bottom `StatusBar`. All resizable panes
  use the shared `SplitPane` primitive.
- **The status bar has three zones, divided by hairlines, and a new item joins
  one of them.** *Leading* — how the workspace is set up (panel toggle,
  connection with its environment badge). *Session* — what is true about the
  statement that just ran (tx badge, row count, row-limit badge, duration); every
  item is conditional and the zone disappears with its divider, so an idle bar
  carries no empty scaffolding. *Trailing* — controls for the view rather than
  state (the zoom stepper), right-aligned. Zones are separated by 1px lines, not
  by gaps: at 32px there is no room to space groups far enough apart to read as
  groups. Metrics render value-bright/unit-muted with no punctuation between
  them. Every control in the bar stands at the 28px dense tier.
- **Three bars, three jobs, and nothing crosses over.** The top bar is
  *navigation* — where you go. The status bar is *session state* — what is true
  right now. The rail is *destinations*, with app-level actions in its trailing
  group. So the connection switcher sits in the status bar beside the transaction
  badge (which database you are pointed at is state, not navigation) and settings
  sits at the foot of the rail. A bar that carries session state, navigation and
  app settings at once is three bars wearing one hat, which is what the top bar
  had become.
- **The top bar is the title bar.** The native one is removed on every platform
  (`drop_native_titlebar` in `lib.rs`; macOS keeps its traffic lights floated over
  ours via `titleBarStyle: "Overlay"`). It carries `data-tauri-drag-region="deep"`
  so the whole bar drags — Tauri's hit test excludes buttons and inputs, so no
  control has to opt out — and it insets its leading edge on macOS to clear the
  traffic lights. Both constants live in `utils/platform.ts`.
- **A rail destination needs a panel of its own.** Import and export are actions
  on the object in front of you — a table, a result — so they live at that object
  (`TableDataView`, `ResultsPane`), not behind a rail item with nothing to show.
- Every destination wraps itself in `Panel` (40px header carrying its title and
  its own actions, over a scrolling body). Panels never stack: if a layout has to
  auto-collapse the user's open sections to fit, it belongs behind the rail.
- **One panel at a time.** The rail selects what the panel shows. Panels never
  stack and compete for height — if a layout needs to auto-collapse the user's
  open sections to fit, it is over-subscribed and belongs behind the rail.
- **Density tier (§1).** One set of sizes, everywhere:

  | Element | Height |
  |---|---|
  | Dialog header/footer, nav rail item | 56px (`h-14`) |
  | Title bar, toolbar, tab strip | 40px (`h-10`) |
  | List / tree / menu row | 36px (`h-9`) |
  | Control (button, icon button, field) | 32px (`h-8`) |
  | Dense control (in-toolbar icon button) | 28px (`h-7`) |
  | Status bar | 32px (`h-8`) |
  | Data grid header | 40px (`h-10`) |
  | **Data grid row** | **28px (`h-7`) — the one exemption** |

  Nav rail is 72px wide with 56px items; panel default width ~280px.
  Padding steps: `p-2` inside rows, `p-3` for panel sections, `p-4` for dialogs —
  nothing larger.
- Prefer tables and dense flex rows over cards. A card is for a genuinely
  self-contained object, not for visually grouping two fields.
- **Forms** (connection editor, table designer): single column, `label above
  input` via the `Field` primitive — never a hand-written `<label><span
  class="text-label-sm …">` block. 12-col grid only when pairing short fields
  (host/port). No bento grids anywhere — this app is panes and tables.
- **Multi-step flows** use `Stepper` and gate the primary action per step. If a
  flow's decisions are sequential (you cannot map columns before choosing a
  file), a single scrolling form lets the user skip one silently.
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
  `variant: 'filled' | 'tonal' | 'outlined' | 'text' | 'text-error' | 'danger'`, `size: 'sm' | 'md'`,
  `rounded-full` (M3 buttons are pills). Filled = `--primary`/`--on-primary`;
  tonal = `--primary-container`/`--on-primary-container`; outlined = transparent +
  1px `--outline`; text = transparent, state layer only; danger =
  `--error-container`/`--on-error-container`. `Button` owns the state layer — call
  sites never add hover classes.
- **IconButton** — `rounded-full`, `place-items-center`, state layer on hover.
  32px default / 28px dense. `title` required (doubles as `aria-label`). Toggled
  state = `--secondary-container` fill.
- **Input / Select / Checkbox** — M3 **outlined text field**: 32px, `rounded-sm`,
  1px `--outline-variant` resting → `--primary` 2px on focus, label
  `text-label-md` `--on-surface-variant`. Error: `--error` border +
  `text-body-sm` `--error` message below; never a toast for field validation.
  `Select` is still a native `<select>` — it becomes a trigger + `Menu` in U4,
  when `Menu` exists.
- **Badge** — the small static status marker: 20px, `rounded-full`, tonal fill,
  `text-label-sm` uppercase. `variant: 'neutral' | 'primary' | 'ok' | 'warn' | 'error'`.
  Used for tx state (`TX`), row-limit notices, read-only connections and engine
  tags (`PG` `MY` `SQ`) — all of which sit inside 32px bars.
- **Chip** — the M3 chip: 32px, `rounded-full`, interactive, optionally
  removable. **Not the same thing as `Badge`** — a 32px chip inside a 32px bar
  fills it edge to edge, which is why the two stay separate components. Its job
  is making state *visible and reversible*: an active grid sort or hidden column
  shows as a chip you can click off, never as state buried in the menu that set
  it. `NULL` cells are neither chip nor badge — they are `--grid-null` italic
  mono in place.
- **SideSheet** — right-edge M3 sheet, `absolute` inside its container so it
  overlays content instead of resizing it. Not a dialog: the cell inspector
  exists so you can read a value *while* still arrow-keying around the grid, and
  a modal would trap focus and block exactly that.
- **ListItem** — the M3 list row: 36px, leading icon slot, headline, optional
  supporting text, trailing slot, `stateLayerPill` hover. Every list of objects
  (connections, saved queries, history, settings destinations) uses it — a
  hand-rolled `<div class="flex h-9 …">` row is a review failure.
- **Dividers** are `border-outline-variant` / `divide-outline-variant` utilities,
  not a component — the token already centralises the colour, so wrapping a 1px
  rule in a Svelte component buys nothing.
- **Menu** — the M3 menu surface: `rounded-md`, `--surface-container-high`,
  `shadow-e2`, 36px rows, `Kbd` hints right-aligned, destructive items `--error`
  text. It is `ui/menu.ts` (surface + row classes + `MenuItem`) plus `MenuRow`,
  shared by `ContextMenu` and `DropdownMenu` — a module rather than a wrapper
  component, because anchoring, focus and dismissal differ per trigger and
  bits-ui already solves each. A new menu consumes these; it never restyles rows.
- **SegmentedButton** — M3 segmented button for 2–5 exclusive options that must
  stay visible (theme variant, grid view mode). Not a substitute for `Select`.
- **Modal / ConfirmDialog** — M3 dialog: centered, `max-w-md`/`max-w-lg`,
  **`rounded-xl` (28px)**, `--surface-container-high`, `shadow-e3`, scrim
  `--surface` at 60% (**no blur**). Headline `text-title-lg`. Actions
  bottom-right, text/tonal buttons. ConfirmDialog is invoked only via the global
  `confirm()` store (§9) — never instantiated inline.
- **SideSheet** — right-edge M3 sheet, `rounded-md` on the leading corners,
  `shadow-e2`. Used for cell inspection; it overlays the workspace and never
  displaces the grid.
- **NavRail / NavRailItem** — 72px rail, 40px items each holding a 56×32 pill
  with a 20px icon. Active item marked by the M3 pill indicator
  (`--secondary-container`), never by colour alone. **Icon only**: the name lives
  on `aria-label` and shows on hover through `Tooltip` (`side="right"`), because a
  permanent word under every icon spends a lot of column on names learned in a
  day. `NavRailItem` passes all ARIA through and takes no view on what it is: a
  destination arrives carrying `role="tab"` and roving `tabindex`, a trailing
  action (Settings) arrives as a plain button. Actions stay **outside** the
  tablist — inside it, `End` would land on something that is not a destination
  and assistive tech would count it as one.
- **SearchField** — M3 docked search field: 32px pill on
  `--surface-container-low`, leading search icon, trailing clear. It owns text
  only; filtering is the caller's job, and no consumer debounces or fetches —
  every filter runs over an in-memory list, so a keystroke costs no IPC (§10).
- **CommandPalette** (`components/command/`, not `ui/` — it reads stores) — the
  one global search surface, opened with `mod+k` from anywhere. Tables, saved
  queries, connections and actions in a single **globally ranked** list; the kind
  rides along as a trailing label rather than splitting the list into groups, so
  the best match is always first. Matching is `utils/filter.ts` — subsequence,
  not substring — which is also what every panel filter uses, so "does `usr` find
  `users`?" has one answer everywhere.
- **Toast / ToastHost** — M3 **snackbar**: bottom-left stack, `rounded-sm`,
  `--surface-container-highest`, `shadow-e2`, single line + optional text action;
  auto-dismiss 4s (errors 8s, or sticky with action). Created only via the global
  `toast.*` API (§9).
- **Tooltip** — M3 plain tooltip: 400 ms delay, `text-body-sm`,
  `--surface-container-highest`, `rounded-xs`, no arrow. It replaces the native
  `title` on icon-only controls; the accessible name stays on `aria-label`, so
  the tooltip is decoration and nothing depends on it. Never set both — two
  tooltips fire at different delays on top of each other. It renders **no element
  of its own**: its `children` snippet receives the trigger props and the control
  spreads them onto its own element. Wrapping instead nests that control inside
  bits-ui's `<button tabindex="0">` — invalid markup, a second tab stop on every
  icon button, and fatal to anything with a role of its own, since a `role="tab"`
  inside a button is not a tab. It never opens from **non-keyboard focus**: a
  mouse click leaves focus on the control, and without that rule the tooltip
  flashes straight back up over whatever the click just did. `suppressed` turns
  it off for a label that has stopped being news — the rail's open destination
  names itself in the panel header beside it. Suppress; never unwrap
  conditionally, which recreates the control's DOM node and drops keyboard focus.
- **EmptyState** — one sentence in `--on-surface-variant`, an optional `hint`
  naming the next step in `--on-surface-muted`, at most one action. Same two-line
  shape as `ErrorState`, so loading, empty and error speak with one voice. The
  icon is **off by default**: inside a rail panel it restates the rail icon two
  inches away, which is decoration pretending to be information. Pass one only
  where the surface has no icon of its own.
- **"Nothing matches …"** comes from `noMatches()` in `utils/filter.ts`, beside
  the matcher whose result it describes. Four panels each writing their own is
  how one app ends up saying "Nothing matches" and "No matches for".
- **ErrorState** — the one error rendering: warning icon, the kind's headline,
  the next step, then the backend's own message in mono, plus an optional action
  snippet. `size: 'block' | 'inline'` (pane vs. toolbar/list strip) and `filled`
  for a failed row inside a list. It takes an `ErrorKind`, never an `ApiError` —
  `ui/` may not know the api layer (§9) — and gets its words from
  `utils/errorPresentation.ts`. Hand-writing an error block at a call site is a
  review failure; that is exactly how the app ended up with three different
  titles for one `kind`.
- **ResizeHandle** — the WAI-ARIA window splitter: a focusable `role="separator"`
  carrying `aria-valuenow`, driven by pointer *and* by arrows / Home / End. The
  parent owns what the value means and supplies `toValue`; the handle owns
  capture, the key map and the ARIA contract. `SplitPane` and `PanelHost` both
  consume it — a second hand-rolled separator is how one of them ended up
  mouse-only.
- **Spinner** — 3 sizes; inline in buttons while pending (`Button` handles it via
  a `loading` prop).
- **Kbd** — takes a shortcut spec (`"mod+shift+f"`), never pre-rendered key text,
  and emits one 16px `<kbd>` per key inside a grouping `<kbd>` — so a chord reads
  as separate caps and platform labels come from the one catalogue (§7).
  Modifiers render as the macOS glyph set (`⌘ ⇧ ⌥`) on **every** platform:
  "Ctrl+Shift+F" reads as a sentence where "⌘+⇧+F" reads as three keys. It is a
  deliberate look, not a claim about the hardware. Two rules follow from it —
  chords join with `+` off macOS (only macOS runs its modifiers together), and a
  literal `ctrl` binding renders as `⌘` off macOS too, because there it is the
  same physical key as `mod` and one key may not appear under two symbols.
- **Tabs** — M3 primary tabs: 40px strip, label + optional icon, active marked by
  a **3px `--primary` indicator** under the label. No vertical dividers between
  tabs, no background-swap-only active state.
- **TreeItem** — 36px row, `stateLayerPill` hover, indent guides, chevron in a
  fixed 16px leading slot so labels align across depths.
- **VirtualList / SplitPane** — shared primitives; any scrolling data list must
  use `VirtualList` (§10).

## 7. Interaction & Keyboard

### State layers (M3)

Interaction is expressed as a **translucent layer of the content colour over the
container**, never as a swapped-in background colour and never as opacity on the
control itself.

| State | Layer |
|---|---|
| Hover | content colour @ 8% |
| Focus / pressed | content colour @ 10% |
| Disabled | 38% content, no layer |

**Components import the layer; they never write it.** `ui/stateLayer.ts` exports
two:

- `stateLayer` — the layer clipped to the element's own shape. Buttons, icon
  buttons, chips, menu rows.
- `stateLayerPill` — the layer as a `rounded-full` pill inset 4px from the row
  edge. List rows, tree rows, nav rail items.

Both use a `::before` overlay of `bg-current`, so one class string works on
filled, tonal, outlined and text variants without knowing its own background —
including the filled-button case M3 calls out, where the layer is `on-primary`
over `primary`.

A literal `hover:bg-on-surface/8` at a call site is a review failure even though
the value is right: the point is that there is exactly one place to change it.

**Two surfaces are exempt, and only these two:**

- **Drag handles and separators** (`SplitPane`, sidebar and section resize grips)
  signal with `--primary` directly. A translucent layer over a 1px line is
  invisible, so the layer would be a no-op.
- **Data grid rows.** The grid renders thousands of rows through `VirtualList`;
  a `::before` pseudo-element per row is measurable overhead, and the layer's
  `overflow-hidden` would clip the selected cell's outline. Grid rows carry
  `hover:bg-on-surface/8` directly — the same value, applied without the
  pseudo-element. This is the same carve-out §2 makes for grid shape.

Focus is **additionally** a 2px `--primary` ring via `:focus-visible` (app.css
`@layer base`). State layer and focus ring coexist; neither replaces the other.

### Motion

- Default: `transition-* duration-200 ease-standard` — matches Flow Desktop's
  `transition-colors duration-200 ease-out` idiom and M3's standard easing.
- Entrances (dialog, menu, snackbar, side sheet): `ease-emphasized`, ≤300 ms,
  fade + a small scale or slide. No spring, no bounce, no stagger, no parallax.
- **Fade-through** when the nav rail swaps panels: 90 ms out, 210 ms in, no slide.
- A tab strip animates tabs **opening and closing** (`uiSlide`), never the
  *content* behind a tab switch. Sliding a virtualized grid or a full editor on
  every switch costs frames and makes a keyboard-driven tool feel sluggish —
  switching to an already-loaded tab must be instant. The M3 cue that a tab
  changed is the indicator, not a transition.
- **Forbidden:** cascading/staggered reveals, fade-in-up hero entrances, skeleton
  shimmer, anything over 300 ms.
- `prefers-reduced-motion` disables all of it (already enforced globally in
  `app.css`).
- **The app is fully keyboard-operable.** Core map (Cmd on macOS = Ctrl elsewhere):
  - `Ctrl+Enter` run statement at cursor / selection · `Ctrl+Shift+Enter` run whole script
  - `Ctrl+T` / `Ctrl+W` new / close editor tab · `Ctrl+PgUp/PgDn` switch tabs
  - `Ctrl+S` save query · `Ctrl+Shift+F` format SQL · `Escape` cancel running query / close overlay
  - `Ctrl+B` toggle panel · `Ctrl+K` command palette (tables, saved queries,
    connections, actions — the single global search entry point)
  - Grid: arrows/Tab navigate, `Enter` edit cell, `Escape` revert cell, `Ctrl+Enter` commit pending edits, `Ctrl+C` copy cell/selection (TSV), `Ctrl+Shift+C` advanced copy (headers/delimiter/quoting)
  - Grid: `Space` toggles the cell inspector, `Escape` closes it — while a cell
    editor is open the input keeps `Escape` for reverting, because it stops
    propagation.
  - Tree rows follow the ARIA tree pattern: `Enter`/`Space` activate,
    `ArrowRight` expands and `ArrowLeft` collapses. The arrows are *directional*,
    not a toggle — `→` on an open node leaves it open. A row that announces
    `aria-expanded` owes the keys that go with it.
  - Separators are operable: arrows nudge, `Home`/`End` jump to the bounds. This
    is `ResizeHandle` (§6), so the split pane and the side panel behave alike.
  - Actions that live in a context menu stay reachable: the row is focusable, so
    the platform's own `Shift+F10` / Menu key opens it.
  - Shortcuts live in `src/lib/utils/keyboard.ts` (single registry — no scattered
    `onkeydown` listeners) and are shown in menus/tooltips via `Kbd`.
- **Svelte transitions are JS-driven and the CSS `prefers-reduced-motion` block
  does not reach them.** Every one goes through `utils/motion.ts`, which checks
  the media query itself and collapses duration *and* delay to zero. A raw
  `transition:fade` from `svelte/transition` at a call site silently opts out of
  that; `motion.test.ts` scans the tree and fails on one.
- **Frictionless settings:** flat lists with visible controls; no accordions
  hiding core options.
- Destructive actions (`DROP`, `DELETE`/`UPDATE` without `WHERE`, `TRUNCATE`,
  row deletion, disconnect with open tx) always route through `confirm()` with a
  danger-variant dialog naming the object: "Drop table `users`?" — never a bare
  "Are you sure?".
- **Environment is a first-class guardrail.** A connection profile is `local`,
  `staging`, `prod`, or **untagged** — untagged is a real state and never
  defaults to `local`, because a reassuring badge on an unclassified connection
  is worse than none. The value tints its badge on the status bar's connection
  chip and in the connection list, and on `prod` every destructive confirm names the environment
  in its title via `envConfirmTitle()`. Only operations that *write* escalate —
  discarding staged edits touches nothing on the server. Environment is never
  conveyed by colour alone; the badge always carries the label. All of it flows
  from `utils/environment.ts`, so no component decides for itself what production
  looks like.

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
- **Error:** `utils/errorPresentation.ts` maps **every** `ErrorKind` to a
  headline and the next step, and `ui/ErrorState.svelte` (§6) renders it. The map
  is a full `Record`, not a `Partial`: a new variant in `errors/mod.rs` fails to
  compile here until someone writes what the user should read and do, which is
  what keeps "every kind has a specific rendering" true instead of aspirational.
  A test also parses `errors/mod.rs` and fails if the Rust and TS kind sets
  drift. Call sites choose the *shape* (`block`, `inline`, `filled`) and supply
  the recovery action; they never write the words. Kind-specific behaviour on
  top of that:
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
  - Truly unexpected (`internal`) → error toast, sticky, with a "Copy details"
    action. This is the **only** kind allowed to toast generically.
  - Every error toast goes through `toast.fromError(e, context?)` — one entry
    point, so a caught `ApiError` always reads as its kind's headline rather than
    a raw backend string, and always carries "Copy details". A pane that already
    renders the failure inline does **not** also toast it; saying it twice is
    worse than saying it once.
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
9. Raw text sizes (`text-xs`, `text-sm`, `text-[11px]`) instead of a type role (§4)
10. Hand-written hover states instead of `stateLayer` / `stateLayerPill` (§7)
11. Off-tier heights — anything but 56 / 40 / 36 / 32 / 28 px, grid rows excepted (§5)
12. A hand-rolled list row instead of `ListItem`, a hand-rolled menu instead of
    `Menu`, a hand-rolled error block instead of `ErrorState`, or a hand-rolled
    separator instead of `ResizeHandle` (§6)
13. An error title or hint written at a call site instead of taken from
    `errorPresentation.ts`, or a `Partial<Record<ErrorKind, …>>` anywhere (§8)
14. `transition:` bound to anything but a `utils/motion.ts` helper (§7)
15. A pointer handler (`onpointerdown`, `onmousedown`) with no keyboard path to
    the same action (§7)

Any hit → **rewrite before presenting**. These are also review-blocking in PRs.
