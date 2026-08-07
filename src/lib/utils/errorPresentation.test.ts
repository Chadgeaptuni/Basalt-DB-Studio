import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { presentError } from "./errorPresentation";
import { ERROR_KINDS } from "$lib/api/types";

// vitest runs from the project root, and `import.meta.url` is not a file: URL
// under the jsdom environment.
const rustErrors = () =>
  readFileSync(join(process.cwd(), "src-tauri/src/errors/mod.rs"), "utf8");

describe("errorPresentation", () => {
  it("gives every kind its own title and an actionable hint", () => {
    for (const kind of ERROR_KINDS) {
      const { title, hint } = presentError(kind);
      expect(title, kind).toBeTruthy();
      expect(hint, kind).toBeTruthy();
      // The generic-error ban (DESIGN §8) is what this whole map exists to enforce.
      expect(title.toLowerCase(), kind).not.toContain("something went wrong");
      expect(title, kind).not.toBe("Error");
    }
  });

  it("never reuses one title for two kinds", () => {
    const titles = ERROR_KINDS.map((k) => presentError(k).title);
    expect(new Set(titles).size).toBe(ERROR_KINDS.length);
  });

  // types.ts claims to mirror AppError "kept in lockstep by hand". This reads the
  // Rust file so the claim is checked rather than trusted: a variant added to
  // kind() with no TS member (or vice versa) fails here, which is the only place
  // the drift is catchable before it reaches a user as an unstyled fallback.
  it("matches the kind() strings in errors/mod.rs exactly", () => {
    const body = rustErrors();
    const fn = body.slice(body.indexOf("pub fn kind("));
    const rustKinds = [...fn.matchAll(/=>\s*"([a-zA-Z]+)"/g)].map((m) => m[1]);

    expect(rustKinds.length).toBeGreaterThan(0);
    expect([...rustKinds].sort()).toEqual([...ERROR_KINDS].sort());
  });
});
