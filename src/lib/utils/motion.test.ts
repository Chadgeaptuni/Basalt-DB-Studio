import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fadeThroughIn, fadeThroughOut, uiFade, uiScale, uiSlide } from "./motion";

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

  const helpers = { uiFade, uiScale, uiSlide, fadeThroughIn, fadeThroughOut };

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
