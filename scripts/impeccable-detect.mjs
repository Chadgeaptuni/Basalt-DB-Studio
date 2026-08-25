#!/usr/bin/env node
// Runs the Impeccable design detector against this project.
//
// Two reasons this wrapper exists rather than a path in package.json: the
// plugin lives in a version-pinned cache dir (…/impeccable/<version>/…) that
// moves on every plugin update, and a missing detector must fail loudly. A
// silently-skipped scan is what let this project sit at zero findings while
// DESIGN.md carried no frontmatter for the engine to read — the detector only
// loads a design system from that frontmatter, so without it every
// design-system-* rule abstains and the scan looks clean.
//
// Complements scripts/design-check.mjs, which owns the Tailwind-utility and
// import-boundary rules the detector's CSS-value scanner cannot express.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CACHE = path.join(os.homedir(), ".claude", "plugins", "cache", "impeccable", "impeccable");

function newestDetector() {
  if (!fs.existsSync(CACHE)) return null;
  // Version dirs sort newest-last under numeric-aware collation.
  const versions = fs
    .readdirSync(CACHE)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  for (const v of versions.reverse()) {
    const candidate = path.join(CACHE, v, "skills", "impeccable", "scripts", "detect.mjs");
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

const detector = newestDetector();
if (!detector) {
  console.error(
    "impeccable detector not found under ~/.claude/plugins/cache/impeccable/.\n" +
      "Install the Impeccable plugin, or run `pnpm design-check` alone for the\n" +
      "project-local rules only (note that this loses the design-system-* rules).",
  );
  process.exit(1);
}

const targets = process.argv.slice(2).filter((a) => a !== "--");
try {
  execFileSync("node", [detector, ...(targets.length ? targets : ["src"])], { stdio: "inherit" });
} catch (e) {
  process.exit(e.status ?? 1);
}
