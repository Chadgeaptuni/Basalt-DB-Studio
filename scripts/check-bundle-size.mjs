#!/usr/bin/env node
// Fails CI when the primary installer for the current OS exceeds the 30 MB
// hard ceiling (see CLAUDE.md "Hard constraints" + the design spec). Walks the
// Tauri release bundle dir, prints every produced artifact's size, then gates
// on the largest artifact in the platform's primary-installer category.
//
// No-op (exit 0) when the bundle dir is absent, so it is safe to run without a
// prior `pnpm tauri build`. Node stdlib only — no dependencies.

import fs from "node:fs";
import path from "node:path";

import { releaseDir } from "./target-dir.mjs";

const LIMIT_BYTES = 30 * 1024 * 1024;
const BUNDLE_DIR = path.join(releaseDir(), "bundle");

// Recognized installer/app artifact extensions (compared lower-cased).
const ARTIFACT_EXTS = new Set([
  ".dmg",
  ".app",
  ".appimage",
  ".deb",
  ".rpm",
  ".msi",
  ".exe",
  ".nsis",
]);

// Primary installer category per OS, in priority order. The first extension
// with a match becomes the gated category (e.g. the .dmg, not the raw .app).
const PRIMARY_EXTS = {
  darwin: [".dmg", ".app"],
  win32: [".msi", ".exe", ".nsis"],
  linux: [".appimage", ".deb", ".rpm"],
};

function humanMB(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// Sum sizes of real files under a dir. `withFileTypes` uses lstat semantics, so
// symlinks are skipped — avoids double-counting .app framework version links.
function dirSize(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) total += dirSize(full);
    else if (entry.isFile()) total += fs.statSync(full).size;
  }
  return total;
}

function collectArtifacts(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const ext = path.extname(entry.name).toLowerCase();
    if (entry.isDirectory()) {
      if (ext === ".app") {
        // macOS .app is a bundle directory — one artifact, don't descend.
        out.push({ path: full, ext, size: dirSize(full) });
      } else {
        collectArtifacts(full, out);
      }
    } else if (entry.isFile() && ARTIFACT_EXTS.has(ext)) {
      out.push({ path: full, ext, size: fs.statSync(full).size });
    }
  }
}

if (!fs.existsSync(BUNDLE_DIR)) {
  console.log(`No bundle directory at ${BUNDLE_DIR} — nothing to check (skipping).`);
  process.exit(0);
}

const artifacts = [];
collectArtifacts(BUNDLE_DIR, artifacts);

if (artifacts.length === 0) {
  console.log(`No installer artifacts found under ${BUNDLE_DIR} (skipping).`);
  process.exit(0);
}

artifacts.sort((a, b) => b.size - a.size);

console.log(`Bundle artifacts under ${BUNDLE_DIR}:`);
const relWidth = Math.max(
  ...artifacts.map((a) => path.relative(BUNDLE_DIR, a.path).length),
);
for (const a of artifacts) {
  const rel = path.relative(BUNDLE_DIR, a.path).padEnd(relWidth);
  console.log(`  ${rel}  ${humanMB(a.size).padStart(10)}`);
}

// Pick the primary category for this OS; fall back to the overall largest
// artifact if none of the expected extensions were produced.
const order = PRIMARY_EXTS[process.platform] ?? [];
let gated = null;
let category = null;
for (const ext of order) {
  const matches = artifacts.filter((a) => a.ext === ext);
  if (matches.length > 0) {
    gated = matches;
    category = ext;
    break;
  }
}
if (!gated) {
  console.warn(
    `No primary installer (${order.join(", ") || "n/a"}) found for platform ` +
      `'${process.platform}'; gating on the largest artifact instead.`,
  );
  gated = artifacts;
}

const largest = gated.reduce((max, a) => (a.size > max.size ? a : max));
const label = category ? `primary installer (${category})` : "largest artifact";
console.log(
  `\n${label}: ${path.relative(BUNDLE_DIR, largest.path)} — ` +
    `${humanMB(largest.size)} (limit ${humanMB(LIMIT_BYTES)})`,
);

if (largest.size > LIMIT_BYTES) {
  console.error(
    `\nBundle size check FAILED: ${humanMB(largest.size)} exceeds the ` +
      `${humanMB(LIMIT_BYTES)} ceiling.`,
  );
  process.exit(1);
}

console.log("Bundle size check passed.");
process.exit(0);
