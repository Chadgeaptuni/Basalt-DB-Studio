import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cubicBezier,
  dialogIn,
  dialogOut,
  EASE_EMPHASIZED,
  EASE_EMPHASIZED_ACCELERATE,
  EASE_STANDARD,
  fadeThroughIn,
  fadeThroughOut,
  panelIn,
  panelOut,
  popIn,
  popOut,
  scrimIn,
  scrimOut,
  sheetIn,
  sheetOut,
  toastIn,
  toastOut,
  uiFade,
  uiSlide,
} from "./motion";

const node = () => document.createElement("div");

function matchReduced(reduce: boolean): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: reduce && query.includes("prefers-reduced-motion"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

function svelteFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) svelteFiles(path, out);
    else if (entry.endsWith(".svelte")) out.push(path);
  }
  return out;
}

describe("motion", () => {
  afterEach(() => vi.unstubAllGlobals());

  const helpers = {
    uiFade,
    uiSlide,
    popIn,
    popOut,
    dialogIn,
    dialogOut,
    scrimIn,
    scrimOut,
    sheetIn,
    sheetOut,
    panelIn,
    panelOut,
    toastIn,
    toastOut,
    fadeThroughIn,
    fadeThroughOut,
  };

  it("animates at its documented duration by default", () => {
    matchReduced(false);
    for (const [name, fn] of Object.entries(helpers)) {
      expect(fn(node()).duration, name).toBeGreaterThan(0);
    }
  });

  // Svelte transitions are JS-driven, so app.css's `prefers-reduced-motion` block
  // — which only reaches CSS transitions and animations — does not cover them.
  // Every helper has to collapse itself, and the audit is only worth anything if
  // it covers all of them rather than the one that happened to be checked.
  it("collapses to zero under prefers-reduced-motion", () => {
    matchReduced(true);
    for (const [name, fn] of Object.entries(helpers)) {
      const config = fn(node());
      expect(config.duration, name).toBe(0);
      expect(config.delay ?? 0, name).toBe(0);
    }
  });

  it("sequences the fade-through so the halves do not overlap", () => {
    matchReduced(false);
    expect(fadeThroughIn(node()).delay).toBe(fadeThroughOut(node()).duration);
  });

  // An entrance is the app answering; an exit is it getting out of the way. An
  // exit that takes as long as its entrance is what reads as lag.
  it("leaves faster than it arrives", () => {
    matchReduced(false);
    const lasts = (config: { duration?: number }): number => config.duration ?? 0;
    const pairs = {
      pop: [popIn, popOut],
      dialog: [dialogIn, dialogOut],
      scrim: [scrimIn, scrimOut],
      sheet: [sheetIn, sheetOut],
      panel: [panelIn, panelOut],
      toast: [toastIn, toastOut],
    };
    for (const [name, [enter, exit]] of Object.entries(pairs)) {
      expect(lasts(exit(node())), name).toBeLessThan(lasts(enter(node())));
    }
  });

  // The scrim and the frame are one surface as far as the eye is concerned. When
  // they ran at different durations the backdrop finished first on the way in and
  // vanished first on the way out, leaving the dialog hanging over a live,
  // undimmed app — which is what "abrupt" turned out to mean.
  it("moves the scrim on the dialog's clock, both ways", () => {
    matchReduced(false);
    expect(scrimIn(node()).duration).toBe(dialogIn(node()).duration);
    expect(scrimOut(node()).duration).toBe(dialogOut(node()).duration);
  });

  // The exit does not retrace the entrance: a frame travelling back down on
  // dismissal pulls the eye after it instead of returning it to the app.
  it("gives the dialog travel on the way in and none on the way out", () => {
    matchReduced(false);
    const at = (fn: (n: Element) => { css?: (t: number, u: number) => string }, t: number) =>
      fn(node()).css?.(t, 1 - t) ?? "";

    expect(at(dialogIn, 0)).toContain("translateY(8px)");
    expect(at(dialogIn, 1)).toContain("translateY(0px)");
    expect(at(dialogOut, 0)).not.toContain("translateY");
  });

  // DESIGN §7: nothing over 300 ms.
  it("keeps every duration inside the ceiling", () => {
    matchReduced(false);
    for (const [name, fn] of Object.entries(helpers)) {
      const { duration = 0, delay = 0 } = fn(node());
      expect(duration + delay, name).toBeLessThanOrEqual(300);
    }
  });

  describe("cubicBezier", () => {
    it("pins the ends and stays monotonic between them", () => {
      const ease = cubicBezier(EASE_EMPHASIZED);
      expect(ease(0)).toBe(0);
      expect(ease(1)).toBe(1);

      let previous = 0;
      for (let x = 0.05; x < 1; x += 0.05) {
        const y = ease(x);
        expect(y).toBeGreaterThanOrEqual(previous);
        previous = y;
      }
    });

    // The entrance curves decelerate — most of the distance is covered early —
    // which is the whole reason for using them over `linear`.
    it("front-loads the distance on the entrance curves", () => {
      expect(cubicBezier(EASE_STANDARD)(0.5)).toBeGreaterThan(0.5);
      expect(cubicBezier(EASE_EMPHASIZED)(0.5)).toBeGreaterThan(0.5);
    });

    // And the exit curve does the opposite: it holds, then leaves. A dialog
    // dismissed on a decelerating curve looks reluctant to go.
    it("back-loads the distance on the exit curve", () => {
      expect(cubicBezier(EASE_EMPHASIZED_ACCELERATE)(0.5)).toBeLessThan(0.5);
    });

    it("resolves a straight line exactly", () => {
      const linear = cubicBezier([0.25, 0.25, 0.75, 0.75]);
      for (const x of [0.1, 0.25, 0.5, 0.75, 0.9]) {
        expect(linear(x)).toBeCloseTo(x, 5);
      }
    });
  });

  // The JS curves and the CSS ones have to be the same curves, or an overlay
  // decelerates differently from the state layer of the control that opened it —
  // which is exactly the mismatch these were added to remove. Tailwind needs the
  // literals in app.css, so the copy in motion.ts is checked against them here.
  it("uses the same curves app.css does", () => {
    const css = readFileSync(join(process.cwd(), "src/app.css"), "utf8");
    const points = (name: string): number[] => {
      const found = new RegExp(`--ease-${name}:\\s*cubic-bezier\\(([^)]+)\\)`).exec(css);
      if (!found) throw new Error(`--ease-${name} is not declared in app.css`);
      return found[1].split(",").map((n) => Number.parseFloat(n));
    };

    expect(points("standard")).toEqual([...EASE_STANDARD]);
    expect(points("emphasized")).toEqual([...EASE_EMPHASIZED]);
    expect(points("emphasized-accelerate")).toEqual([...EASE_EMPHASIZED_ACCELERATE]);
  });

  // The reason the helpers can be trusted: nothing bypasses them. A raw
  // `transition:fade` from svelte/transition would ignore the reduced-motion
  // check entirely and no test would notice.
  it("is the only source of transitions in the app", () => {
    const offenders = svelteFiles(join(process.cwd(), "src"))
      .filter((f) => !f.endsWith(".test-harness.svelte"))
      .filter((f) => /\b(?:transition|in|out):(?:fade|scale|slide|fly|blur|draw)\b/.test(
        readFileSync(f, "utf8"),
      ));

    expect(offenders, "import from $lib/utils/motion instead").toEqual([]);
  });
});
