import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import X from "@lucide/svelte/icons/x";
import IconButton from "./IconButton.svelte";
import { stateLayer } from "./stateLayer";

// The cursor is the pointer half of DESIGN §7's interaction model: the state
// layer says a control is reacting, the cursor says it is operable, and a
// control that lights up under an arrow that never changes reads as decoration.
// It is one rule in app.css rather than a class per component, so this reads the
// stylesheet the same way motion.test.ts reads the easing curves out of it.
const css = readFileSync(join(process.cwd(), "src/app.css"), "utf8");

// The prelude regex captures everything between the previous `}` and the next
// `{`, which includes comments sitting directly above a rule. A comment that
// names a selector under discussion — `[data-disabled]` in the not-allowed
// block's own comment — would satisfy a toContain without any CSS change.
const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");

// Innermost rules only — the `[^{}]` classes make the match stop inside
// `@layer base { … }` rather than swallowing it.
const rules = [...cssWithoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(
  ([, prelude, body]) => ({
    prelude: prelude.trim(),
    body: body.trim(),
  }),
);

function selectorsFor(declaration: string): string {
  const matching = rules.filter((r) => r.body.includes(declaration));
  if (matching.length === 0) throw new Error(`no rule in app.css declares ${declaration}`);
  return matching.map((r) => r.prelude).join(" ");
}

// The CSS cursor keywords — every value this app could plausibly want.
const CURSOR_VALUES =
  "auto|default|none|pointer|progress|wait|text|cell|crosshair|help|move|grab|grabbing|" +
  "not-allowed|no-drop|context-menu|col-resize|row-resize|ew-resize|ns-resize|" +
  "n-resize|e-resize|s-resize|w-resize|ne-resize|nw-resize|se-resize|sw-resize|" +
  "nesw-resize|nwse-resize|all-scroll|zoom-in|zoom-out|" +
  "inherit|initial|unset|revert";
// Without the trailing (?![\w-]), a CSS-in-JS `cursor: textPosition` trips on `text`.
const CURSOR_DECLARATION = new RegExp(
  `\\bcursor["']?\\s*:\\s*["']?(?:${CURSOR_VALUES})(?![\\w-])`,
);

function declaresLocalCursor(text: string): boolean {
  return /\bcursor-[a-z]/.test(text) || CURSOR_DECLARATION.test(text);
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

  // The rule above is only worth anything if nothing overrides it — a Tailwind
  // `cursor-*` utility or a raw cursor declaration in a component both outrank
  // `@layer base` whatever their specificity. The utility half catches class
  // names; the declaration half catches CSS/JS-object values and is anchored on
  // a CSS cursor keyword so `cursor: Position` or `cursorOffset:` do not
  // false-positive.
  // The tree scan passes vacuously when the tree is clean, so the detector needs
  // its own cases or a broken detector reads as a green suite.
  it("detects local cursor declarations and utilities", () => {
    for (const sample of [
      "cursor: pointer;",
      "cursor:pointer",
      'cursor: "pointer",',
      "cursor: 'text';",
      "cursor: not-allowed;",
      "cursor: col-resize;",
      "cursor: grabbing;",
      'class="cursor-pointer"',
      "cursor: unset;",
      "cursor: nwse-resize;",
      '"cursor": "text"',
    ]) {
      expect(declaresLocalCursor(sample), sample).toBe(true);
    }
    for (const sample of [
      "cursor: pointerEvents",
      "cursor: textPosition",
      "cursor: Position",
      "cursor: string",
      "cursor: number",
      "cursorOffset: number",
    ]) {
      expect(declaresLocalCursor(sample), sample).toBe(false);
    }
  });

  it("is the only place a cursor is declared", () => {
    // A splitter is dragged, not clicked: `ResizeHandle` says so with
    // `cursor-col-resize` / `cursor-row-resize`, and it is the only surface that
    // means something the base rule cannot express.
    const exempt = ["src/lib/components/ui/ResizeHandle.svelte", "src/app.css"];
    const root = process.cwd();

    const sources = (dir: string, out: string[] = []): string[] => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) sources(path, out);
        else if (/\.(svelte|ts|css)$/.test(entry) && !entry.endsWith(".test.ts")) out.push(path);
      }
      return out;
    };

    const offenders = sources(join(root, "src"))
      .filter((f) => declaresLocalCursor(readFileSync(f, "utf8")))
      .map((f) => relative(root, f).split(sep).join("/"))
      .filter((f) => !exempt.includes(f));

    expect(offenders, "the rule in app.css already covers these").toEqual([]);
  });

  // `pointer-events: none` hands the cursor to whatever sits under the element,
  // so a disabled button reported its toolbar's arrow and the `not-allowed` rule
  // reached the one control that most needs it — never.
  it("keeps a disabled control hit-testable", () => {
    // `before:pointer-events-none` stays and must not be matched here: that one
    // keeps the overlay itself from swallowing the click. It is the `disabled:`
    // variant — the whole control — that has to go.
    expect(stateLayer).not.toContain("disabled:pointer-events-none");
    expect(stateLayer, "the hover overlay has to be suppressed some other way").toContain(
      "disabled:hover:before:opacity-0",
    );
  });

  // What blocks the click is the attribute, not the pointer-events rule that was
  // removed above. `IconButton` is the control under test because it needs no
  // children snippet.
  it("still blocks a disabled button", () => {
    render(IconButton, { icon: X, title: "Close", disabled: true });
    expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
  });
});
