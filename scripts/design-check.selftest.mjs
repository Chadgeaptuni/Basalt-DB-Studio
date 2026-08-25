#!/usr/bin/env node
// One runnable check: every rule in design-check.mjs must fire on a line that
// violates it, and the clean control must produce nothing. A silently-inert
// detector is the exact failure this guards — the Impeccable engine sat at zero
// findings for this repo because DESIGN.md carried no frontmatter, and nothing
// noticed.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

const CHECKER = path.join(import.meta.dirname, "design-check.mjs");

// One violating line per rule id. Kept as data so a new rule without a fixture
// fails the coverage assertion below rather than shipping untested.
const VIOLATIONS = {
  "no-shadow-off-scale": `<div class="shadow-lg">x</div>`,
  "no-gradient": `<div class="bg-gradient-to-r">x</div>`,
  "no-glassmorphism": `<div class="backdrop-blur-md">x</div>`,
  "no-color-literal": `<div style="color:#8b5cf6">x</div>`,
  "no-raw-text-size": `<div class="text-xs">x</div>`,
  "no-arbitrary-radius": `<div class="rounded-[7px]">x</div>`,
  "no-hand-written-hover": `<div class="hover:bg-surface-container">x</div>`,
  "no-off-tier-height": `<div class="h-11">x</div>`,
  "no-emoji": `<div>Done 🎉</div>`,
  "no-invoke-outside-api": `const r = await invoke("run_query");`,
  "no-legacy-svelte": `<button on:click={go}>x</button>`,
  "no-raw-transition": `import { fade } from "svelte/transition";`,
  "no-hidden-scrollbar": `.pane { scrollbar-width: none; }`,
  "no-partial-error-map": `const m: Partial<Record<ErrorKind, string>> = {};`,
};

// `ui-stays-dumb` is path-scoped (`only`), so it needs a file under
// components/ui/ rather than a line in the flat fixture.
const SCOPED = {
  "ui-stays-dumb": {
    file: "lib/components/ui/Probe.svelte",
    line: `import { toasts } from "$lib/stores/toasts.svelte";`,
  },
};

function run(dir) {
  try {
    const out = execFileSync("node", [CHECKER, "--json", dir], { encoding: "utf-8" });
    return JSON.parse(out);
  } catch (e) {
    // exit 1 means findings; the JSON still went to stdout.
    return JSON.parse(e.stdout);
  }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "design-check-"));

// Every rule declared in the checker must have a fixture.
const declared = [...fs.readFileSync(CHECKER, "utf-8").matchAll(/^\s*id: "([^"]+)"/gm)].map((m) => m[1]);
const covered = new Set([...Object.keys(VIOLATIONS), ...Object.keys(SCOPED)]);
const uncovered = declared.filter((id) => !covered.has(id));
assert.deepEqual(uncovered, [], `rules with no fixture: ${uncovered.join(", ")}`);

// Each violation fires its own rule, one file per rule so unrelated rules on
// the same line cannot mask a miss.
for (const [id, line] of Object.entries(VIOLATIONS)) {
  const dir = path.join(tmp, id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "probe.svelte"), `${line}\n`);
  const hit = run(dir).map((f) => f.rule);
  assert.ok(hit.includes(id), `${id} did not fire on: ${line}`);
}

for (const [id, { file, line }] of Object.entries(SCOPED)) {
  const full = path.join(tmp, id, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${line}\n`);
  const hit = run(path.join(tmp, id)).map((f) => f.rule);
  assert.ok(hit.includes(id), `${id} did not fire in ${file}`);
}

// `rounded-[inherit]` must NOT fire: it names no radius, so it is not an
// off-scale value. The state layer depends on this exemption.
const inheritDir = path.join(tmp, "rounded-inherit");
fs.mkdirSync(inheritDir, { recursive: true });
fs.writeFileSync(path.join(inheritDir, "probe.svelte"), `<div class="before:rounded-[inherit]">x</div>\n`);
assert.deepEqual(
  run(inheritDir).filter((f) => f.rule === "no-arbitrary-radius"),
  [],
  "rounded-[inherit] should be exempt from no-arbitrary-radius",
);

// The waiver suppresses, and the clean control stays silent.
const waived = path.join(tmp, "waived");
fs.mkdirSync(waived, { recursive: true });
fs.writeFileSync(path.join(waived, "probe.svelte"), `<div class="shadow-lg">x</div> <!-- design-check-ignore no-shadow-off-scale -->\n`);
assert.equal(run(waived).length, 0, "waiver comment did not suppress the finding");

const clean = path.join(tmp, "clean");
fs.mkdirSync(clean, { recursive: true });
fs.writeFileSync(
  path.join(clean, "probe.svelte"),
  `<div class="h-9 rounded-full bg-surface-container text-label-md shadow-e2">ok</div>\n`,
);
assert.deepEqual(run(clean), [], "clean control produced findings");

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`design-check self-test: ${declared.length} rules, all fire; waiver and clean control pass`);
