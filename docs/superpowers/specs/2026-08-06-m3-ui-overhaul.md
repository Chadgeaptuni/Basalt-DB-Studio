# Basalt DB Studio — M3 UI/UX Overhaul

**Status:** planned · **Date:** 2026-08-06 · **Governs:** `src/` frontend only
(no backend change) · **Amends:** [DESIGN.md](../../../DESIGN.md) §1–§7

---

## 1. Why

DESIGN.md has said "Material 3 is the law" since the M3 token migration, and the
app still does not read as Material 3. The cause is precise: **only the token
layer was migrated.** The three systems that actually produce the M3 *look* were
never built.

Evidence from the current tree:

| System | M3 requires | Basalt today |
|---|---|---|
| **Shape** | Containers 12–28px; the corner is the signature | `rounded-xs` (4px) is the most-used radius — 13 uses, vs 5 for `rounded-lg`. Dialogs are 16px where M3 specifies 28px |
| **Type scale** | 15 named roles (display/headline/title/body/label) | No scale exists. Every call site picks `text-xs`, `text-[11px]`, `text-[10px]`, `text-sm` by hand |
| **Density** | One coherent tier | 24px (`TreeItem`) → 28px (grid row) → 32px (`Tabs`, `StatusBar`) → 36px (`AccordionSection`) → 40px (`Input`, `Button` md). A 24→40px spread with no system |
| **Components** | Nav rail, search bar, chips, list item, side sheet, segmented button, tab indicator, menu | **None exist.** No search field anywhere in `src/`. `Tooltip` is specced in DESIGN.md §6 and was never built |
| **State layers** | Universal | `ui/stateLayer.ts` exists but only `Button`/`IconButton` consume it. `TreeItem`, `Tabs`, `StatusBar` hand-roll `hover:bg-on-surface/8`; `ThemePicker` uses non-M3 `hover:border-outline` |
| **Elevation** | Tonal ladder does the work | Depth is carried almost entirely by 1px `border-outline-variant` hairlines. `AppShell`, `Sidebar`, `Tabs`, `ResultsPane`, `StatusBar`, `AccordionSection` are each one flat fill + a border edge |

The net effect is a **1px-hairline wireframe** — the DBeaver look — wearing M3
token names. That is the "generic and unprofessional" read.

### Secondary finding: the accordion is over-subscribed

`Sidebar.svelte:30` runs an effect that **auto-collapses the user's open sections
when they no longer fit**. That is not a feature; it is the layout reporting that
too many panels are competing for one column of height.

### Secondary finding: DESIGN.md §3 is stale

§3 still describes the flat-theme model (`THEME_ENTRIES`, "there is no global
light/dark switch"). That model was reverted on 2026-08-06 — themes are palettes
again, with a Light/Dark/OLED variant switch. §3 must be corrected as part of
this work.

---

## 2. Decisions (locked)

| Decision | Choice |
|---|---|
| **Density** | **M3 at desktop density −2.** Full M3 shape, type, state layers and motion, on M3's own compact desktop tier. Rows 36px, controls 32px, container radii 12–16px |
| **Navigation** | **Navigation rail + single full-height panel.** Replaces the accordion sidebar |
| **Sequencing** | Spec + DESIGN.md first (this document), then U0→U6 |

**The density decision is the one that unblocks everything else.** DESIGN.md
currently asserts both "Material 3 is the law" (§1) and "Density first… 28px
controls" (§5). Those fight, and losing that fight is what produced the current
look. M3 ships density tiers for exactly this case: each step is −4dp, so −2
yields a genuinely dense tool that is still unmistakably Material.

**Non-goal:** this is not a port of M3's mobile spec. 48dp touch targets, 56dp
list items and FABs are explicitly rejected — see §9.

---

## 3. The density −2 system (U0)

### 3.1 Density tier

| Element | Size | Utility | Was |
|---|---|---|---|
| Top app bar | 56px | `h-14` | 40px |
| Toolbar / tab strip | 40px | `h-10` | 32px |
| List / tree / menu row | 36px | `h-9` | 24–32px |
| Control (button, icon button, field) | 32px | `h-8` | 32–40px |
| Dense control (in-toolbar icon button) | 28px | `h-7` | 32px |
| Status bar | 32px | `h-8` | 32px |
| Nav rail | 72px wide, 56px items | — | n/a |
| **Data grid row** | **28px — unchanged** | `h-7` | 28px |
| Data grid header | 40px | `h-10` | 36px |

**The data grid keeps its 28px rows.** M3 exempts data tables from list-item
density, and rows-on-screen is the metric that matters most in this app. Every
*other* surface moves to the tier above. The approved "+15% vertical space"
covers chrome, not the grid.

### 3.2 Type scale

Nine named roles, declared once in `app.css` under `@theme` so Tailwind generates
`text-<role>` utilities. **After U0, a raw `text-xs`/`text-[11px]` in a component
is a review failure** — the point is to make the scale the path of least
resistance.

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

`text-data` exists so "all data is mono" (DESIGN §4) is one utility instead of
`font-mono text-xs tabular-nums` repeated at ~40 call sites.

### 3.3 Shape

The scale in DESIGN.md §2 is already correct; the **assignments** are wrong.
Corrected:

| Utility | Size | Assigned to |
|---|---|---|
| `rounded-xs` | 4px | `Kbd`, badge interior, grid-cell affordances |
| `rounded-sm` | 8px | text field, select, inline code block |
| `rounded-md` | 12px | card, panel section, **menu**, dropdown, side sheet |
| `rounded-lg` | 16px | large panel, snackbar |
| `rounded-xl` | 28px | **dialog / modal** |
| `rounded-full` | — | button, icon button, chip, **list & tree row state layer**, avatar, dot |

Two changes carry most of the visual delta:

1. **Dialogs go 16px → 28px.** M3's dialog corner is 28dp at every density. This
   is the single strongest M3 cue in the app and it is currently absent.
2. **Row hover becomes a `rounded-full` pill inset 4px from the row edge**,
   instead of a full-bleed rectangle. This is the M3 navigation-drawer/list
   idiom, and it is what makes a tree read as Material rather than as a table.

### 3.4 State layers

`ui/stateLayer.ts` gains a second export, `stateLayerPill`, and **every**
interactive surface consumes one of the two. No component hand-writes a hover
colour after U0. The percentages (8% hover / 10% pressed) are already correct.

### 3.5 Motion

Current defaults (`duration-200 ease-standard`, `ease-emphasized` for entrances)
stay. Two additions:

- **Fade-through** when the rail swaps panels — 90ms out / 210ms in, no slide.
- **Shared-axis-x** when switching workspace tabs, matching the existing
  `uiSlide` helper's axis convention.

Both respect the existing global `prefers-reduced-motion` rule.

---

## 4. Target layout

```
┌──────────────────────────────────────────────────────────────┐
│ ◆ Basalt   ⌕ Search tables, queries, actions… ⌘K   [prod ●]  │  56px top app bar
├────┬──────────────────────┬──────────────────────────────────┤
│ ▣  │ ⌕ filter             │  users ×   orders ×   +          │  40px tabs + indicator
│ ▤  │ ▾ public             │ ────────────────────────────────  │
│ ◷  │   users      1.2k    │  SQL editor                      │
│ ⇅  │   orders      88k    │ ─────────────────────────────────│
│ ⎇  │   ▸ …                │  1.2k rows · 12ms  [chips]   ⋮   │
│    │                      │  grid                    │ insp  │  side sheet
└────┴──────────────────────┴──────────────────────────────────┘
 72px    resizable panel            workspace
 rail    (one at a time)
```

- **Rail destinations:** Schema · Queries · History · Transfer · Git. One panel
  at a time, full height. Active item gets the M3 pill indicator.
- **Top app bar** carries brand, the search/command entry point, and the
  connection with its environment colour.
- **Side sheet** slides over the right edge of the workspace for cell inspection;
  it never displaces the grid.

### 4.1 The five differentiators

These are the reason to do this work at all — restyling alone would leave a
better-looking version of the same tool.

1. **Command palette (`⌘K`).** Tables, saved queries, connections, actions,
   recent results. The app's charter is keyboard-driven; this is the affordance
   that signals it. DESIGN.md §7 already reserves `Ctrl+K` "if/when shipped" —
   this ships it.
2. **Environment colour on the connection.** A profile is `local` / `staging` /
   `prod`. The value tints the connection chip in the top app bar, and `prod`
   escalates every destructive confirm to name the environment. This is the
   feature users cite when they say they trust a DB GUI.
3. **Cell inspector side sheet.** JSON / BLOB / long text opened in an M3 side
   sheet with syntax highlighting. Today a long cell is a truncated grid cell
   with a `title` tooltip.
4. **Column header menus + filter chips.** Sort / filter / hide / copy from the
   header; active filters render as removable M3 filter chips above the grid, so
   grid state is *visible and reversible* instead of hidden.
5. **Filter-first schema.** Persistent search field, kind chips (Tables / Views),
   row counts, pinned tables. `SchemaTree` has no filter at all today; on a
   300-table schema it is unusable.

---

## 5. New primitives

All land in `src/lib/components/ui/` except the rail and panel host, which are
layout.

**A primitive is built by the milestone that first consumes it, not up front.**
Building all eleven in U0 would have shipped nine components with zero call
sites, which the codebase rules forbid outright (no dead code, no
over-engineering). Revised ownership:

| Primitive | Purpose | Milestone |
|---|---|---|
| `ListItem` | M3 list row, 36px, pill state layer | **U0 — built** |
| `SegmentedButton` | theme variant switch, grid view modes | **U0 — built** |
| `NavRail` + `NavRailItem` | left rail with pill indicator | U1 |
| `PanelHost` | renders the rail's active panel, owns resize | U1 |
| `SearchField` | M3 docked search bar | U2 |
| `CommandPalette` | `⌘K` over `SearchField` | U2 |
| `Tooltip` | replaces native `title` on icon-only controls | U3 |
| `Menu` | shared surface once column headers are its second consumer | U4 |
| `Chip` | assist / filter / input — first consumed by grid filter chips | U4 |
| `SideSheet` | right-edge sheet, cell inspector | U4 |

**`Divider` was dropped.** A 1px rule is `border-outline-variant` /
`divide-outline-variant` — the token already centralises the colour, so a
component would add a DOM node and an import for nothing.

**`Badge` is not folded into `Chip`.** They are distinct M3 components and the
original plan was wrong to merge them: a chip is a 32px interactive object, a
badge is a small static status marker (`TX`, `limit`, `PG`) living inside 32px
bars — a chip there would fill the bar edge to edge. `Badge` keeps its own
5-variant API; its legacy `accent`/`danger` aliases were removed in U0.

**Considered and rejected:** FAB (a floating action button is wrong for a
desktop tool with a persistent toolbar), bottom sheet (mobile pattern),
navigation drawer (the rail plus a panel already covers it).

---

## 6. Per-component work

50 components. `—` means no visual change.

### `ui/` primitives

| Component | Lines | Change | M |
|---|---|---|---|
| `Button` | 72 | Heights → 32/28; label-large; keep pill | U0 |
| `IconButton` | 51 | 32/28; active state → pill indicator | U0 |
| `Input` | 54 | **40 → 32**; M3 outlined field; supporting-text slot | U0 |
| `Select` | 33 | Rebuild on `Menu`; outlined trigger | U0 |
| `Checkbox` | 29 | M3 18px box + state layer | U0 |
| `Badge` | 35 | Folded into `Chip` | U0 |
| `Modal` | 114 | `rounded-lg` → `rounded-xl` (28px); M3 dialog padding/action row | U0 |
| `ConfirmDialog` | 38 | Inherits dialog shape; danger action styling | U0 |
| `ContextMenu` | 46 | Rebuilt on `Menu`; 36px rows | U0 |
| `Toast` | 48 | M3 snackbar shape + action slot | U0 |
| `EmptyState` | 23 | Type scale | U0 |
| `Kbd` | 28 | label-small | U0 |
| `Spinner` | 21 | M3 circular progress track | U0 |
| `SplitPane` | 108 | M3 divider handle + hover target | U0 |
| `TreeItem` | 77 | **24 → 36px**; pill state layer; indent guides | U0 |
| `VirtualList` | 71 | Default `rowHeight` follows the tier | U0 |
| `Tabs` | 103 | **3px indicator**, 40px, drop `border-r` dividers | U3 |
| `BrandMark` | 11 | — | — |

### Layout

| Component | Lines | Change | M |
|---|---|---|---|
| `AppShell` | 39 | Rail + `PanelHost` + top app bar composition | U1 |
| `TopBar` | 42 | M3 top app bar, 56px, search entry, env chip | U1 |
| `Sidebar` | 81 | **Replaced** by `PanelHost` | U1 |
| `AccordionSection` | 92 | **Retired** — the rail removes the need | U1 |
| `StatusBar` | 53 | Tx chip, type scale, 32px | U1 |
| `StartPanel` | 122 | Rebuilt as home: connections + palette hint | U1 |
| `ToastHost` | 20 | Snackbar stack positioning | U0 |
| `ConfirmDialogHost` | 19 | — | — |

### Domain

| Component | Lines | Change | M |
|---|---|---|---|
| `schema/SchemaTree` | 152 | Search field, kind chips, row counts, pins, pill rows | U2 |
| `savedQueries/SavedQueriesPanel` | 103 | Rail panel; search; `ListItem` | U2 |
| `history/HistoryPanel` | 47 | Rail panel; search; `ListItem` | U2 |
| `gitsync/GitSyncBar` | 58 | Moves into the Git rail panel | U2 |
| `connections/ConnectionSwitcher` | 143 | Top-bar menu; env colour | U1 |
| `workspace/Workspace` | 69 | Tab host; pinned results | U3 |
| `editor/EditorPane` | 167 | 40px toolbar; run affordance; statement markers | U3 |
| `editor/CodeEditor` | 65 | CM theme → type scale, gutter, selection | U3 |
| `grid/ResultsPane` | 145 | Toolbar; filter-chip row; statement tabs | U3 |
| `grid/DataGrid` | 227 | Column header menus, sort/filter, inspector hook | U4 |
| `grid/TableDataView` | 266 | Same + edit affordances, row detail | U4 |
| `connections/ConnectionForm` | 172 | M3 fields; **new Environment field** | U5 |
| `connections/ConnectionRow` | 49 | `ListItem`; env dot; status trailing | U5 |
| `importExport/ImportWizard` | 109 | M3 stepper | U5 |
| `ddl/TableDesigner` | 86 | Dense editor on new primitives | U5 |
| `ddl/DdlPreviewModal` | 82 | Dialog shape; SQL block | U5 |
| `ddl/ColumnDialog` | 57 | Fields + dialog shape | U5 |
| `ddl/IndexDialog` | 58 | Fields + dialog shape | U5 |
| `ddl/RenameDialog` | 33 | Fields + dialog shape | U5 |
| `ddl/DdlHost` | 23 | — | — |
| `savedQueries/SaveQueryDialog` | 56 | Fields + dialog shape | U5 |
| `settings/SettingsModal` | 181 | Nav → M3 list; 28px dialog | U5 |
| `settings/ThemePicker` | 188 | `SegmentedButton` variant switch; `ListItem` rows | U5 |
| `settings/CustomThemeEditorModal` | 112 | Fields + dialog shape | U5 |

---

## 7. Milestones

Each gate blocks the next. **U0 is not a preference of ordering** — restyling
components before the type and density scales exist means doing the work twice.

**U0 — Foundations. ✅ done 2026-08-06.** Type scale + density tier + shape
assignments in `app.css`; `stateLayer`/`stateLayerPill` universal; `ListItem` and
`SegmentedButton` built; all 18 `ui/` primitives and all 26 domain components
migrated. No layout change.
*Gate: zero raw `text-xs`/`text-[Npx]` outside `app.css` ✅; zero hand-written
hover colours outside the two documented carve-outs ✅; `svelte-check` 0 errors
and 92/92 vitest ✅.*

Carve-outs found during U0 and written into DESIGN.md §7: **drag handles and
separators** signal with `--primary` directly (a translucent layer over a 1px
line is invisible), and **data grid rows** keep a direct
`hover:bg-on-surface/8` (a `::before` per row across thousands of virtualized
rows is real overhead, and the layer's `overflow-hidden` would clip the selected
cell's outline).

**Deferred out of U0 to the milestone that consumes them:** `Select` stays a
native `<select>` until U4, when `Menu` gains its second consumer and the popup
pattern is proven — converting it now would mean inventing a bits-ui Select API
against a primitive nothing else uses yet.

**U1 — Shell. ✅ done 2026-08-06.** Nav rail, 56px M3 top app bar, `PanelHost`
and `Panel`; `Sidebar`, `AccordionSection` and `stores/sidebar.svelte.ts`
retired.
*Gate: every rail destination reachable by mouse and keyboard ✅ (5 new
`NavRail` tests); panel resize and `mod+b` collapse preserved ✅; no auto-collapse
effect remains ✅ (the store it lived in is deleted); `svelte-check` 0 errors /
0 warnings and 97/97 vitest ✅.*

**The rail carries four destinations, not five — Transfer was dropped.** There
is no transfer *panel* to show: `ImportWizard` is a per-table modal launched from
`TableDataView`, and export is a per-result action in `ResultsPane`. A fifth rail
item would have been an empty shell. Import/export stay where the object they act
on lives; if a transfer history or queue is ever built, the destination comes
back with it.

**History moved out of `ResultsPane` in U1 rather than U2.** Once the rail had a
History destination, leaving the old toggle in the results toolbar would have
been two routes to one panel — the duplication rule, not a scheduling
preference. `ResultsPane` lost its `showHistory`/`onToggleHistory` props.

**`StartPanel` was not rebuilt.** Its planned U1 content was the connection list
(already there) plus a command-palette hint, and the palette does not exist until
U2. Advertising a shortcut that does nothing is worse than leaving the pane
alone; it is rebuilt in U2 alongside `CommandPalette`.

`stateLayer.ts` gained a third export, `stateLayerGroup` — the layer driven by an
ancestor `group` rather than its own hover, for composite controls where the hit
target is the whole block but M3 draws the layer on one child (the rail item's
72×56 block vs. its 56×32 indicator pill). This is a variant, not a carve-out:
the rail still never hand-writes a hover colour.

**U2 — Search. ✅ done 2026-08-06.** `SearchField`, `CommandPalette` (`mod+k`),
the shared matcher, schema filter with a kind selector, saved-queries and history
search, top-bar and start-panel entry points.
*Gate: `mod+k` opens from anywhere and reaches tables, saved queries, connections
and actions ✅; schema filter usable on a 300-table fixture ✅; zero IPC per
keystroke ✅ (asserted by counting IPC calls while typing, not by feel);
`svelte-check` 0 errors / 0 warnings and 117/117 vitest ✅.*

**Row counts were dropped.** `RelationNode` carries only `name` and `kind` —
counts would need new per-engine introspection in `src-tauri/`, and "no backend
change" is a stated non-goal of this programme (§9). The kind filter ships; if
row counts are wanted they are a backend change with their own scope.

**Kind filtering uses `SegmentedButton`, not filter chips.** All / Tables / Views
is a single exclusive choice over three fixed options, which is exactly what a
segmented button is for — and it already exists from U0. `Chip` stays in U4,
where removable *multi*-value grid filters actually need it.

**`CommandPalette` is a domain container, not a `ui/` primitive.** It reads four
stores (schema, saved queries, connections, panel), and `ui/` may not import
stores (DESIGN §9). It lives at `components/command/`. `SearchField` — which owns
only text — is the `ui/` half.

Results are ranked globally rather than grouped by kind: when you type, the best
match should be first whatever it is, with the group riding along as a trailing
label. The list caps at 50 and says how many it dropped rather than truncating
silently. A new `stores/palette.svelte.ts` holds visibility so the shortcut, the
top-bar button and the start panel can all open it without one owning the state.

**U3 — Workspace. ✅ done 2026-08-07.** M3 tab indicator, editor / results /
table toolbars on the tier, CodeMirror theme aligned, `Tooltip` built and adopted
by `IconButton`.
*Gate: statement result tabs keep their error tone ✅ (asserted active **and**
inactive); the indicator marks exactly one tab and follows the active one ✅;
`svelte-check` 0 errors / 0 warnings and 120/120 vitest ✅.*

**The shared-axis content transition was cut, and DESIGN.md §7 corrected.**
Sliding a virtualized grid or a full editor on every tab switch costs frames and
makes a keyboard-driven tool feel sluggish — switching to an already-loaded tab
has to be instant. The M3 cue that a tab changed is the indicator, not a
transition. The tab strip still animates tabs *opening and closing*.

**Statement gutter markers are deferred.** Showing which statement will run at
the cursor needs statement boundaries, and those come from `sqlgen/`'s splitter
in the backend. The options were a new command returning statement ranges, or a
second splitter in TypeScript — one is a backend change (a stated non-goal), the
other is exactly the duplication the codebase rules forbid, with the added risk
of the two disagreeing about what a statement is. It needs its own scoped
decision.

**Elevation moved to real custom properties.** `--shadow-e*` lived in
`@theme inline`, which emits no CSS variable, so the CodeMirror theme — which
builds its own stylesheet and cannot use Tailwind utilities — would have needed a
second copy of the shadow values. `--elevation-1/2/3` now live in `@layer base`
and `@theme inline` maps `--shadow-e*` onto them, so both readers share one
source.

`Tooltip` replaces the native `title` on every `IconButton`: native tooltips take
about a second, ignore the theme, and render differently per OS. The accessible
name stays on `aria-label`, which a regression test now pins — the tooltip is
decoration and no screen reader depends on it.

**U4 — Data surface. ✅ done 2026-08-07.** `Menu` extracted, `Chip` and
`SideSheet` built, column header menus with sort / hide / copy, removable state
chips, cell inspector side sheet.
*Gate (rewritten — see below): sort reorders by value and never misroutes an edit
✅; hiding respects the last column ✅; inspector renders JSON, text-that-is-JSON,
BLOB previews and a 1M-character value without handing the DOM the whole thing
✅; grid rows stay 28px ✅; `svelte-check` 0 errors / 0 warnings and 140/140
vitest ✅.*

**Sort is client-side and says so — the original gate was unachievable.** It read
"sort/filter round-trips on all three engines", which means server-side `ORDER
BY`. `grid_browse` takes only `limit`, so that is a backend change, and "no
backend change" is a stated non-goal (§9). Client-side sorting of a row-limited
page is the trap it sounds like: sorting the first 1000 of 100k rows by amount
does *not* show the largest amount. So the sort chip carries the caveat — it
turns `warn`-toned and reads "loaded rows only" **exactly when the result is
truncated**, and reads plainly when it isn't, because on a complete result the
sort is simply correct. Server-side sort remains open as its own backend-scoped
item.

**Row filtering was not built.** With sort already caveated by truncation, a
row filter over a truncated page compounds the same lie — it would show "3
matches" when the table has 3000. The chip infrastructure is in place for when
filtering can be pushed to SQL.

**Two correctness details worth recording.** Sorting returns *row indices*, not
reordered rows, because staged edits identify their row by index — handing the
grid shuffled rows would commit an edit to the wrong record. There is a test
pinning exactly that. And NULLs pin last in both directions, outside the
direction flip: NULL is absence, not a smallest value, so letting `desc` float
them to the top would bury the rows the user asked to see.

`Menu` landed as `ui/menu.ts` (surface + row classes + `MenuItem`) plus
`MenuRow.svelte`, consumed by both `ContextMenu` and the new `DropdownMenu` —
a shared module rather than a wrapper component, because anchoring, focus and
dismissal genuinely differ per trigger and bits-ui already solves each.

**U5 — Flows. ✅ done 2026-08-07.** `Stepper` and `Field` built, import wizard
rebuilt as three gated steps, DDL / save-query / custom-theme dialogs on `Field`,
settings nav and theme picker on `ListItem`, legacy `Button` aliases retired,
**connection environments** end to end.
*Gate: environment reaches the top bar and the destructive confirm ✅; every
dialog 28px cornered ✅ (all seven route through `Modal`); import wizard walks a
CSV end to end ✅; `svelte-check` 0 errors / 0 warnings, 150/150 vitest,
65/65 cargo, clippy clean ✅.*

**The "no backend change" non-goal was relaxed for environments, deliberately.**
`environment` had to live in the profile TOML: profiles are the git-sync unit, so
a tag stored client-side would warn only the machine that set it — useless for
the team case that motivates the feature. The field is
`Option<Environment>` with `#[serde(default, skip_serializing_if)]`, so profiles
written before it existed still load, and they load **untagged rather than
defaulted to `local`** — putting a reassuring badge on a connection nobody
classified is worse than no badge. Two Rust tests pin that: legacy TOML loads
with `environment: None`, and a tagged profile round-trips through the file.

Colour is never the signal — the chip always carries the label, so `prod` reads
the same to a colour-blind user. `envConfirmTitle()` prefixes destructive
confirms with "Production:" on tagged prod connections only, and only for
operations that actually write: discarding *staged* edits touches nothing on the
server, so it stays a plain confirm.

**`Stepper` and `Field` were not in the plan.** The import wizard was one
scrolling form where you could reach Import having never looked at the column
mapping — the three steps exist because the decisions are genuinely sequential
and each gate blocks an unanswered one. `Field` was extracted after finding the
same `<label><span class="text-label-sm tracking-wider …">` block written out at
seventeen call sites.

**`Stepper` and `Field` were not in the plan.** The import wizard was one
scrolling form where you could reach Import having never looked at the column
mapping — the three steps exist because the decisions are genuinely sequential
and each gate blocks an unanswered one. `Field` was extracted after finding the
same `<label><span class="text-label-sm tracking-wider …">` block written out at
seventeen call sites.

The theme picker's 22 preset cards became list rows: a card grid of 22 is a wall,
and the only thing distinguishing them is the swatch, which a row carries just as
well.

**U6 — Audit.** Loading / empty / error for every `ErrorKind`; contrast check
across 22 palettes × 3 variants; keyboard sweep; reduced-motion sweep.
*Gate: every `ErrorKind` in `errors/mod.rs` has a specific rendering; all
palette × variant combinations pass WCAG AA for body text; every action
reachable without a mouse.*

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| Density −2 still costs rows on screen | Grid rows are explicitly exempt (§3.1). The cost lands on chrome, where it buys legibility |
| Rail is a muscle-memory break for existing users | `mod+b` still collapses the panel; rail destinations map 1:1 onto today's accordion sections |
| 50 components is a large surface | U0 front-loads the shared cost; U1–U5 are independently shippable and each has a gate |
| Bundle size (30MB ceiling) | New primitives are hand-rolled, no new dependencies. `bits-ui` already covers dialog/menu behaviour |
| DESIGN.md describing an unbuilt target | DESIGN.md carries a migration note pointing here, with the owning milestone per system |

## 9. Explicitly not doing

- M3 mobile density (48dp targets, 56dp list items) — this is a desktop tool.
- FAB, bottom sheet, navigation drawer.
- Rounding data-grid cells or rows.
- Any backend change — **with one recorded exception**: `environment` on
  `ConnectionProfile` (U5), because the tag has to git-sync with the profile to
  be worth having. Nothing else in `src-tauri/` is touched by this programme.
- New dependencies. Everything here is hand-rolled or built on `bits-ui`, which
  is already a dependency.
