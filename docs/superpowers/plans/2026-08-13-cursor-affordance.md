# Cursor Affordance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every operable control in the app shows a pointer cursor, every disabled
one shows `not-allowed`, and nothing else changes — declared once in `app.css`
instead of per component.

**Architecture:** One rule in `app.css`'s `@layer base`, keyed on what an element
*is* (`button`, `a[href]`, checkbox/radio/colour inputs and their `<label>`, and
the ARIA roles bits-ui puts on non-button rows: `menuitem`, `option`, `tab`,
`treeitem`, `switch`) rather than on a class a call site remembers to add. This is
the same shape as the other globally-declared surfaces in that file — scrollbars,
the focus ring, the reduced-motion block. Because Tailwind utilities outrank
`@layer base`, a surface that means something other than "click me" opts out with
a `cursor-*` utility, and `ResizeHandle` is the only file allowed to. The four
local `cursor-*` declarations that exist today (two of which fight the new rule)
are deleted, and a tree-scanning test keeps them from coming back.

**Tech Stack:** Tailwind CSS v4 (CSS-first, `@layer base` in `src/app.css`),
Svelte 5 runes, vitest + `@testing-library/svelte`, Tauri 2 webview
(WebKit on macOS/Linux, Chromium on Windows — `:has()` is available on both).

**Spec:** [DESIGN.md](../../../DESIGN.md) §7 "Interaction & Keyboard". §7 owns
state layers, focus and motion but says nothing about the cursor, which is why
the app drifted; Task 1 writes the missing half of §7 in place, and that section
is the spec the rest of the plan implements.

## Global Constraints

- `pnpm` for all Node tooling. Never `npm`/`npx`; package binaries run through
  `pnpm exec`. Gate for this plan: `pnpm check` (svelte-check + vitest run).
- No new dependencies — the 30 MB installed-bundle ceiling is enforced in CI
  (`scripts/check-bundle-size.mjs`). This change is CSS and deletions.
- Do not bump versions in `package.json`, `tauri.conf.json`, or `Cargo.toml`.
- **Never commit or push without explicit user approval.** The commit steps below
  are written out, but ask before running them.
- Commit format: `type(scope): short description`.
- No colour literals, gradients, `backdrop-blur`, or shadows on in-layout
  elements; no raw text sizes; no hand-written hover states. `cursor` is not a
  colour and the new rule adds none.
- Documentation is edited **in place**, so it reads as if the corrected version
  had always been there. No changelog prose in `DESIGN.md`.
- No Rust changes, so `cargo` is not part of this plan's gate. There is no
  `graphify-out/` in this repo, so no `graphify update` step either.

**Decisions already made — do not re-litigate:**

1. Menu rows, dropdown items and `Select` options get the **pointer**. The
   deliberate `cursor-default` in `MENU_ROW` goes away.
2. Data grid cells keep the **arrow**. A cell is selected, not followed — the same
   carve-out DESIGN §2 makes for grid shape and §7 for the grid's state layer.
3. Disabled controls get **`not-allowed`**, which is why Task 3 exists: today's
   `disabled:pointer-events-none` in `stateLayer.ts` removes disabled buttons from
   hit testing, so a cursor rule can never reach them.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/app.css` (modify) | The affordance rule itself, in the existing `@layer base` beside the focus rules. The only place a cursor is declared. |
| `DESIGN.md` (modify) | §7 gains the cursor system it was missing, and the Agent Execution Directive gains the matching review item. |
| `src/lib/components/ui/cursor.test.ts` (create) | The guard: app.css declares the rule, and no component re-declares a cursor. Lives beside the `ui/` primitives it governs, in the style of `utils/motion.test.ts`'s app.css parse + tree scan. |
| `src/lib/components/ui/stateLayer.ts` (modify) | Owns disabled presentation, so it is where `pointer-events-none` is traded for an explicit hover-layer suppression. |
| `src/lib/components/ui/TreeItem.svelte`, `Checkbox.svelte`, `menu.ts`, `src/lib/components/settings/CustomThemeEditorModal.svelte` (modify) | Deletions only — the four places that declare a cursor locally today. |

No new component, no new module, no new token. The change is one CSS rule, one
test, and six deletions.

---

### Task 1: Declare the affordance rule once

**Files:**
- Create: `src/lib/components/ui/cursor.test.ts`
- Modify: `src/app.css` (inside `@layer base`, after the `:focus:not(:focus-visible)` rule at lines 168–170, before `::selection`)
- Modify: `DESIGN.md` (§7, after the state-layer exemptions and focus paragraph at "Focus is **additionally** a 2px `--primary` ring…", before `### Motion`)

**Interfaces:**
- Consumes: nothing.
- Produces: `src/lib/components/ui/cursor.test.ts` exports nothing, but Tasks 2
  and 3 append to it and reuse its two local helpers —
  `rules: { prelude: string; body: string }[]` (every innermost rule in
  `app.css`) and `selectorsFor(declaration: string): string` (the selector
  preludes of every rule carrying that declaration, joined by a space).

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/ui/cursor.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The cursor is the pointer half of DESIGN §7's interaction model: the state
// layer says a control is reacting, the cursor says it is operable, and a
// control that lights up under an arrow that never changes reads as decoration.
// It is one rule in app.css rather than a class per component, so this reads the
// stylesheet the same way motion.test.ts reads the easing curves out of it.
const css = readFileSync(join(process.cwd(), "src/app.css"), "utf8");

// Innermost rules only — the `[^{}]` classes make the match stop inside
// `@layer base { … }` rather than swallowing it.
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, prelude, body]) => ({
  prelude: prelude.trim(),
  body: body.trim(),
}));

function selectorsFor(declaration: string): string {
  const matching = rules.filter((r) => r.body.includes(declaration));
  if (matching.length === 0) throw new Error(`no rule in app.css declares ${declaration}`);
  return matching.map((r) => r.prelude).join(" ");
}

describe("cursor affordance", () => {
  // Buttons are the obvious half. The roles are the half that gets missed:
  // bits-ui draws menu items, listbox options and our tree rows as divs, so
  // nothing about them is a button to the engine.
  it("hands a pointer to everything clickable", () => {
    const selectors = selectorsFor("cursor: pointer");
    for (const selector of [
      "button:not(:disabled)",
      "summary",
      "a[href]",
      '[role="button"]',
      '[role="tab"]',
      '[role="option"]',
      '[role="treeitem"]',
      '[role="menuitem"]',
      '[role="switch"]',
      'input[type="checkbox"]:not(:disabled)',
      'input[type="radio"]:not(:disabled)',
      'input[type="color"]:not(:disabled)',
      'label:has(input[type="checkbox"]:not(:disabled))',
    ]) {
      expect(selectors, selector).toContain(selector);
    }
  });

  // 38% opacity says "off" to someone reading the screen; the cursor says it to
  // someone already reaching for the control.
  it("marks a disabled control as inoperable", () => {
    const selectors = selectorsFor("cursor: not-allowed");
    for (const selector of [":disabled", '[aria-disabled="true"]', "[data-disabled]"]) {
      expect(selectors, selector).toContain(selector);
    }
  });

  // A data grid cell is selected, not followed. DESIGN §2 exempts the grid from
  // the shape scale and §7 from the state layer for the same reason, and a
  // pointer over thousands of cells would read as a sheet of links.
  it("leaves the data grid cell alone", () => {
    expect(selectorsFor("cursor: pointer")).not.toContain('[role="gridcell"]');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/lib/components/ui/cursor.test.ts`
Expected: FAIL — all three cases error with `no rule in app.css declares cursor:
pointer` / `cursor: not-allowed`, because `selectorsFor` throws rather than
returning an empty string when nothing declares what it was asked for. A silent
pass on a stylesheet that says nothing is the one result this test must not give.

- [ ] **Step 3: Add the rule to `src/app.css`**

Insert inside the existing `@layer base`, directly after the
`:focus:not(:focus-visible) { outline: none; }` rule and before `::selection`:

```css
  /* Interaction affordance, declared once — the cursor is the pointer half of the
     state layer (DESIGN §7). Keyed on what an element *is* rather than on a class
     a call site remembers, because the miss is never the styled button: it is the
     row bits-ui draws as a div, the segment inside a group, the trigger that
     looks like a field. Utilities outrank `@layer base`, so a surface that means
     something other than "click me" says so with `cursor-*` — the window
     splitter is the only one that does. */
  button:not(:disabled),
  summary,
  a[href],
  [role="button"],
  [role="tab"],
  [role="option"],
  [role="treeitem"],
  [role="menuitem"],
  [role="menuitemcheckbox"],
  [role="menuitemradio"],
  [role="switch"],
  input[type="checkbox"]:not(:disabled),
  input[type="radio"]:not(:disabled),
  input[type="color"]:not(:disabled),
  label:has(input[type="checkbox"]:not(:disabled)),
  label:has(input[type="radio"]:not(:disabled)),
  label:has(input[type="color"]:not(:disabled)) {
    cursor: pointer;
  }

  /* Second, so a disabled menu row lands here: `[role="menuitem"]` above and
     `[data-disabled]` are both one attribute deep, so document order is what
     decides. Text fields keep the caret the engine gives them and the data grid
     keeps the arrow — neither is named in either rule. */
  :disabled,
  [aria-disabled="true"],
  [data-disabled],
  label:has(input:disabled) {
    cursor: not-allowed;
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/lib/components/ui/cursor.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 5: Document the system in `DESIGN.md` §7**

Insert as a new subsection immediately after the focus-ring paragraph that ends
"State layer and focus ring coexist; neither replaces the other." and before
`### Motion`:

```markdown
### Cursor affordance

The state layer says a control is *reacting*; the cursor says it is *operable*.
A control that lights up under a mouse whose arrow never changes reads as
decoration, so the cursor is declared **once**, in `app.css`'s `@layer base`,
keyed on what an element is — `button`, `a[href]`, `summary`, a
checkbox/radio/colour input and the `<label>` that wraps one, and the ARIA roles
bits-ui puts on rows that are not buttons (`menuitem`, `option`, `tab`,
`treeitem`, `switch`).

| Surface | Cursor |
|---|---|
| Anything clickable — buttons, icon buttons, list/tree/menu/listbox rows, tabs, chips, segments, select triggers, rail items | `pointer` |
| Anything disabled — `:disabled`, `aria-disabled`, bits-ui's `data-disabled` | `not-allowed` |
| Text field, number field, editor | the engine's own caret, untouched |
| Data grid cell | the arrow — a cell is selected, not followed (the carve-out §2 makes for grid shape and the state layer above makes for grid rows) |
| Window splitter, resize grip | `col-resize` / `row-resize`, from `ResizeHandle` |

**A `cursor-*` utility in a component is a review failure** unless the surface
genuinely means something other than "click me". Utilities outrank `@layer base`,
so a single local `cursor-default` silently opts a control out of the rule —
which is how the app once had a pointer on tree rows, an arrow on menu rows, and
an arrow on every button in between. `ResizeHandle` is the one file that carries
one, and `ui/cursor.test.ts` enforces both halves.

Disabled controls have to stay hit-testable for the second row of that table to
render at all: `pointer-events: none` hands the cursor to whatever sits
underneath, so the state layer suppresses its own hover overlay on `:disabled`
instead of removing the control from hit testing.
```

- [ ] **Step 6: Run the full gate**

Run: `pnpm check`
Expected: svelte-check 0 errors / 0 warnings, and every vitest suite passing.

- [ ] **Step 7: Commit** (ask for approval first — see Global Constraints)

```bash
git add src/app.css src/lib/components/ui/cursor.test.ts DESIGN.md
git commit -m "fix(ui): point the cursor at every interactive control"
```

---

### Task 2: Delete the local cursors the rule replaces

Four files declare a cursor today. Two of them (`TreeItem`, `Checkbox`) now
duplicate the base rule; one (`menu.ts`) actively overrides it, because a utility
beats `@layer base` — a menu row would keep the arrow while every button around
it turned into a pointer, which is the exact inconsistency this plan removes; one
(`CustomThemeEditorModal`) duplicates it four times. `ResizeHandle` keeps its
resize cursors and is the scan's one exemption.

**Files:**
- Modify: `src/lib/components/ui/TreeItem.svelte:42`
- Modify: `src/lib/components/ui/Checkbox.svelte:13-16`
- Modify: `src/lib/components/ui/menu.ts:42`
- Modify: `src/lib/components/settings/CustomThemeEditorModal.svelte:73,86,99,112`
- Modify: `src/lib/components/ui/cursor.test.ts` (append the tree scan)
- Modify: `DESIGN.md` (Agent Execution Directive list)

**Interfaces:**
- Consumes: the `cursor: pointer` rule from Task 1, and Task 1's `cursor.test.ts`.
- Produces: `MENU_ROW` in `ui/menu.ts` keeps its exported name, value minus
  `cursor-default`. No signature anywhere changes.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/components/ui/cursor.test.ts` — inside the existing
`describe`, after the grid case. Extend the import at the top of the file to
`import { readdirSync, readFileSync, statSync } from "node:fs";` and
`import { join, relative, sep } from "node:path";`:

```ts
  // The rule above is only worth anything if nothing overrides it, and a utility
  // outranks `@layer base` whatever its specificity — so one stray
  // `cursor-default` on a row is invisible in review and total in effect.
  it("is the only place a cursor is declared", () => {
    // A splitter is dragged, not clicked: `ResizeHandle` says so with
    // `cursor-col-resize` / `cursor-row-resize`, and it is the only surface that
    // means something the base rule cannot express.
    const exempt = ["src/lib/components/ui/ResizeHandle.svelte"];
    const root = process.cwd();

    const sources = (dir: string, out: string[] = []): string[] => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) sources(path, out);
        else if (/\.(svelte|ts)$/.test(entry) && !entry.endsWith(".test.ts")) out.push(path);
      }
      return out;
    };

    const offenders = sources(join(root, "src"))
      .filter((f) => /\bcursor-[a-z]/.test(readFileSync(f, "utf8")))
      .map((f) => relative(root, f).split(sep).join("/"))
      .filter((f) => !exempt.includes(f));

    expect(offenders, "the rule in app.css already covers these").toEqual([]);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/lib/components/ui/cursor.test.ts`
Expected: FAIL — the offender list holds exactly these four paths, in whatever
order the directory walk yields them:

```
src/lib/components/settings/CustomThemeEditorModal.svelte
src/lib/components/ui/Checkbox.svelte
src/lib/components/ui/TreeItem.svelte
src/lib/components/ui/menu.ts
```

- [ ] **Step 3: Delete the four local declarations**

`src/lib/components/ui/TreeItem.svelte` — line 42, drop `cursor-pointer`:

```svelte
  class="flex h-9 items-center gap-1.5 pr-3 text-data {stateLayerPill} {focusRing}
    {selected ? 'text-on-surface' : 'text-on-surface-variant'}"
```

`src/lib/components/ui/Checkbox.svelte` — the label keeps the dimming and drops
the cursor; the base rule reads the input inside it and covers both states:

```svelte
<label
  class="inline-flex h-8 items-center gap-2 text-body-md text-on-surface-variant select-none
    {disabled ? 'opacity-[0.38]' : ''}"
>
```

`src/lib/components/ui/menu.ts` — line 42, drop `cursor-default`:

```ts
export const MENU_ROW =
  "flex h-9 items-center gap-2 px-3 text-label-md outline-none " +
  "transition-colors duration-200 ease-standard " +
  "data-[highlighted]:bg-surface-container-highest " +
  "data-[disabled]:pointer-events-none data-[disabled]:opacity-[0.38]";
```

`data-[disabled]:pointer-events-none` **stays**: unlike a real `<button
disabled>`, a bits-ui item is a div with `data-disabled`, and that class is what
makes it inert. The row therefore reports the menu surface's arrow rather than
`not-allowed`, which is honest — the row is not a control at that point.

`src/lib/components/settings/CustomThemeEditorModal.svelte` — all four colour
inputs (lines 73, 86, 99, 112), drop `cursor-pointer`:

```svelte
          class="h-8 w-10 rounded-xs border-0 bg-transparent"
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/lib/components/ui/cursor.test.ts src/lib/components/ui/TreeItem.test.ts src/lib/components/settings/CustomThemeEditorModal.test.ts src/lib/components/ui/ContextMenu.test.ts src/lib/components/ui/Select.test.ts`
Expected: PASS — the scan reports no offenders, and the four suites that render
the edited components are unaffected (none of them asserts on a cursor class).

- [ ] **Step 5: Add the review item to `DESIGN.md`**

In the Agent Execution Directive list at the end of the file, append item 16
after the existing item 15 (`A pointer handler … with no keyboard path …`):

```markdown
16. A `cursor-*` utility in a component, or a clickable control left with the
    default arrow — the affordance rule is global (§7)
```

- [ ] **Step 6: Run the full gate**

Run: `pnpm check`
Expected: svelte-check 0/0/0, all vitest suites passing.

- [ ] **Step 7: Commit** (ask for approval first)

```bash
git add src/lib/components/ui/TreeItem.svelte src/lib/components/ui/Checkbox.svelte \
  src/lib/components/ui/menu.ts src/lib/components/settings/CustomThemeEditorModal.svelte \
  src/lib/components/ui/cursor.test.ts DESIGN.md
git commit -m "refactor(ui): drop the local cursors the global affordance rule replaces"
```

---

### Task 3: Make the disabled cursor reachable

`stateLayer` carries `disabled:pointer-events-none`. That does two jobs: it
suppresses the hover overlay on a disabled control, and it removes the control
from hit testing — and the second one means the engine reports the *container's*
cursor for a disabled button, so `not-allowed` never renders on `Button`,
`IconButton`, `Chip`, `SegmentedButton`, or the `Select` trigger. The overlay
suppression is stated directly instead, and the `disabled` attribute goes on
doing what it always did: blocking the click.

**Files:**
- Modify: `src/lib/components/ui/stateLayer.ts:15-17`
- Modify: `src/lib/components/ui/cursor.test.ts` (append two cases)

**Interfaces:**
- Consumes: the `cursor: not-allowed` rule from Task 1; `Button.svelte` (unchanged)
  as the control under test.
- Produces: `stateLayer`, `stateLayerPill` and `stateLayerGroup` keep their
  exported names and shapes; only the disabled fragment inside them changes.

- [ ] **Step 1: Write the failing test**

Append to the `describe` in `src/lib/components/ui/cursor.test.ts`, and add
`import { render, screen } from "@testing-library/svelte";`,
`import X from "@lucide/svelte/icons/x";`,
`import IconButton from "./IconButton.svelte";` and
`import { stateLayer } from "./stateLayer";` to the imports:

```ts
  // `pointer-events: none` hands the cursor to whatever sits under the element,
  // so a disabled button reported its toolbar's arrow and the `not-allowed` rule
  // reached the one control that most needs it — never.
  it("keeps a disabled control hit-testable", () => {
    // `before:pointer-events-none` stays and must not be matched here: that one
    // keeps the overlay itself from swallowing the click. It is the `disabled:`
    // variant — the whole control — that has to go.
    expect(stateLayer).not.toContain("disabled:pointer-events-none");
    expect(stateLayer, "the hover overlay has to be suppressed some other way")
      .toContain("disabled:hover:before:opacity-0");
  });

  // What blocks the click is the attribute, not the pointer-events rule that was
  // removed above. `IconButton` is the control under test because it needs no
  // children snippet.
  it("still blocks a disabled button", () => {
    render(IconButton, { icon: X, title: "Close", disabled: true });
    expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/lib/components/ui/cursor.test.ts`
Expected: FAIL on the first case — `expected 'relative isolate overflow-hidden …'
not to contain 'disabled:pointer-events-none'`. The second case passes already; it
is the lock on the behaviour the first case changes.

- [ ] **Step 3: Trade the hit-testing guard for an explicit suppression**

In `src/lib/components/ui/stateLayer.ts`, replace the `OPACITY` constant
(lines 15–17):

```ts
// `disabled:pointer-events-none` used to stand in for the last rule here. It also
// took the control out of hit testing, so a disabled button reported its
// container's cursor and app.css's `not-allowed` never rendered on it. The click
// was never what that class was holding back — the `disabled` attribute blocks
// that on its own — so what it was really doing, keeping the hover overlay off,
// is now what it says. `disabled:hover:` is one condition deeper than `hover:`,
// so it wins wherever Tailwind orders the two.
const OPACITY =
  "hover:before:opacity-[0.08] active:before:opacity-[0.10] " +
  "disabled:opacity-[0.38] disabled:hover:before:opacity-0";
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/lib/components/ui/cursor.test.ts src/lib/components/ui/IconButton.test.ts src/lib/components/ui/Modal.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full gate**

Run: `pnpm check`
Expected: svelte-check 0/0/0, all vitest suites passing.

- [ ] **Step 6: Commit** (ask for approval first)

```bash
git add src/lib/components/ui/stateLayer.ts src/lib/components/ui/cursor.test.ts
git commit -m "fix(ui): keep disabled controls hit-testable so not-allowed renders"
```

---

### Task 4: Walk the app

Passing tests are not done: none of the above proves a cursor changed on screen,
because jsdom loads no stylesheet and resolves no `@layer`. This task is the
verification the other three are pointing at, and every case below is one the
plan's rule is meant to cover or deliberately leave alone.

**Files:** none — this task changes nothing unless it finds something.

**Interfaces:**
- Consumes: Tasks 1–3 landed.
- Produces: either a green checklist or a defect to fix inside this task, with a
  case added to `cursor.test.ts` if the miss is expressible there.

- [ ] **Step 1: Start the app**

Run: `pnpm tauri dev`
Expected: the window opens on `StartPanel` with no console errors.

- [ ] **Step 2: Walk the pointer surfaces — every one of these must be a pointer**

- [ ] Title bar: the appearance control, the search entry, window controls on
      Windows/Linux
- [ ] Nav rail: each destination, and Settings in the trailing group
- [ ] Panel headers: every icon button in the Schema, Queries, History and Git
      panel headers
- [ ] Schema tree rows *and* their expand chevrons (the row kept its pointer; the
      chevron button never had one)
- [ ] Connection rows, saved-query rows, history rows, settings destinations —
      every `ListItem`, plus the controls in their trailing slot
- [ ] Command palette (`mod+k`): result rows
- [ ] Context menu on a tree row, the data grid's column-header dropdown, and a
      `Select` in Settings — **rows and options included** (this is the
      `MENU_ROW` change; before it, these were the last arrows left)
- [ ] Editor tabs, their close buttons, and the new-tab button
- [ ] Results toolbar: buttons, chips (sort/hidden-columns), and a chip's remove ×
- [ ] Dialog footers: every `Button` variant, and the header close button
- [ ] `SegmentedButton` (theme variant in Settings) and `Stepper` (Import wizard)
- [ ] Checkbox rows — the whole label, not only the box
- [ ] Theme editor colour swatches
- [ ] Status bar: connection switcher, zoom stepper, panel toggle

- [ ] **Step 3: Walk the surfaces that must NOT change**

- [ ] Text fields (connection form, `SearchField`, the grid's inline cell editor):
      the caret, not a pointer
- [ ] Data grid cells and rows: the arrow. Header dropdown trigger: pointer
- [ ] `SplitPane` and the side-panel edge: `col-resize` / `row-resize`
- [ ] The dialog scrim: the arrow, and clicking it still closes the dialog
- [ ] The title bar's empty area: the arrow, and dragging it still moves the window
- [ ] `StartPanel`'s keyboard reference and other static text: no pointer over
      anything unclickable

- [ ] **Step 4: Walk the disabled cases — each must show `not-allowed`**

- [ ] Import wizard's primary action before a file is chosen
- [ ] A `NumberField` stepper at its limit (Settings → row limit at its minimum)
- [ ] A disabled `Select` or `Input`
- [ ] Hovering any of them shows **no** hover state layer — the control must stay
      visually dead while its cursor says so
- [ ] A disabled `IconButton` still does nothing on click

- [ ] **Step 5: Fix anything the walk found, inside this task**

For each miss, name the root cause before fixing it: a selector the base rule
does not cover (add it to `app.css` **and** to the test's selector list), a local
`cursor-*` that came back (delete it — the scan should have caught it, so work
out why it did not), or a control that is a plain `div` and should be a `button`.
Never patch a call site with `cursor-pointer`.

- [ ] **Step 6: Re-run the gate and commit any fix** (ask for approval first)

Run: `pnpm check`

```bash
git add -A
git commit -m "fix(ui): cover <surface> in the cursor affordance rule"
```

---

## Notes for the implementer

- **Why not `cursor-pointer` on the primitives?** Forty-odd call sites and
  primitives would each need the class, `ui/` primitives would each own a
  duplicate of one decision, and the next hand-rolled control would miss it
  again. Also: the rows that miss out today are exactly the ones bits-ui renders
  as divs, which no `ui/` file styles directly.
- **`:has()` support** — Safari 15.4+ and Chromium 105+. Tauri 2 ships WebKit
  (macOS 13+, webkit2gtk 4.1) and Chromium (WebView2 on Windows), so both are
  well past it. There is no `<input type="radio">` in the app today; the selector
  is there because a radio group is one `Field` away and the rule should not have
  to be revisited for it.
- **Nothing here touches the state layer's hover values, the focus ring, motion,
  or any colour token.** If a diff in this plan changes one of those, it is wrong.
