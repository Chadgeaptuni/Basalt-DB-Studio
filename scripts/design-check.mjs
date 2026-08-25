#!/usr/bin/env node
// DESIGN.md's "Agent Execution Directive" as a build gate.
//
// The Impeccable detector owns the four rules it can express against this
// project (design-system-{color,radius,font,font-size}) once DESIGN.md carries
// its frontmatter. Everything below is the remainder: Tailwind-utility and
// import-boundary rules that a CSS-value scanner structurally cannot see.
// Run both — `pnpm design-check` does.
//
// Waive a line with a trailing or preceding comment: `design-check-ignore <id>`.

import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve(import.meta.dirname, "..", "src");
const EXTS = new Set([".svelte", ".ts", ".css"]);

// `allow` is a list of path fragments the rule does not apply to.
const RULES = [
  {
    id: "no-shadow-off-scale",
    re: /\bshadow-(?!e1\b|e2\b|e3\b)[\w[\]/.-]+/g,
    why: "§1.6 — shadow-e1/e2/e3 are the complete set, floating containers only",
  },
  {
    id: "no-gradient",
    re: /\bbg-gradient-|\bbg-\[linear-gradient|\bbg-\[radial-gradient/g,
    why: "§1 — M3 surfaces are flat tonal fills",
    allow: ["app.css"], // the OS-rendered brand tile composites over a gradient (§1 exception)
  },
  {
    id: "no-glassmorphism",
    re: /\bbackdrop-blur|\bbackdrop-filter/g,
    why: "§1 — no glassmorphism; the dialog scrim is flat --surface at 60%",
  },
  {
    id: "no-color-literal",
    re: /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(/g,
    why: "§3 — every colour is a role token; literals live in themes/ and themeData.ts",
    allow: ["app.css", "/themes/", "themeData.ts", "utils/contrast.ts"],
  },
  {
    id: "no-raw-text-size",
    re: /\btext-(?:xs|sm|base|lg|xl|[2-9]xl)\b|\btext-\[/g,
    why: "§4 — name a type role (text-title-md, text-body-sm, text-data)",
  },
  {
    // `rounded-[inherit]` is exempt: it names no radius, it takes whatever the
    // parent already has. The state layer needs it so the pseudo can carry its
    // own shape instead of being clipped by `overflow-hidden`, which WebKit
    // re-rasterizes on every opacity transition (see ui/stateLayer.ts).
    id: "no-arbitrary-radius",
    re: /\brounded-\[(?!inherit\])|\brounded(?![-\w])/g,
    why: "§2 — the six-step shape scale is the complete set; no bare `rounded`",
  },
  {
    id: "no-hand-written-hover",
    re: /\bhover:(?:bg|border|text)-/g,
    why: "§7 — import stateLayer / stateLayerPill from ui/stateLayer.ts",
    // The two primitives that *declare* the hover every call site then consumes.
    // stateLayer.ts is the module §7 names; ResizeHandle owns the hairline
    // carve-out, where a translucent layer over a 1px line is a no-op.
    allow: ["ui/stateLayer.ts", "ui/ResizeHandle.svelte"],
  },
  {
    id: "no-off-tier-height",
    // Only the sizes DESIGN.md names as failures. Icon glyph boxes (h-4, h-5)
    // size to their content and are explicitly not governed by the tier.
    re: /\bh-(?:6|11|12|13|15|16)\b/g,
    why: "§5 — the tier is 56/40/36/32/28px (h-14/10/9/8/7); grid rows excepted",
    allow: ["NavRail", "TopBar"], // the 64px rail and its mirrored leading box are w-16/h-16 by spec
    // A height paired with an explicit small width is a glyph/badge box sizing
    // to its content (§5's own exemption: chevron slots, badge caps, swatches),
    // not a row/control/bar standing on the tier.
    skipLine: /\bw-(?:[3-9]|1[0-2])\b/,
  },
  {
    id: "no-emoji",
    re: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu,
    why: "§1 — icons are Lucide, monochrome",
  },
  {
    id: "no-invoke-outside-api",
    re: /\binvoke[(<]/g,
    why: "§9 — invoke() lives only in src/lib/api/",
    allow: ["/lib/api/"],
  },
  {
    id: "ui-stays-dumb",
    // `import type` is erased at build time, so a ui/ primitive naming a wire
    // type (ErrorState taking an ErrorKind, §6) carries no runtime coupling.
    // A value import from either module is the real violation.
    re: /^(?!\s*import\s+type\b).*\bfrom\s+["']\$lib\/(?:stores|api)\//gm,
    why: "§9 — components/ui/ may not import stores or the api layer",
    only: ["/components/ui/"],
  },
  {
    id: "no-legacy-svelte",
    re: /\bon:[a-z]+=|<slot[\s/>]|createEventDispatcher|^\s*\$:/gm,
    why: "Svelte 5 — onclick, snippets, callback props, $derived",
  },
  {
    id: "no-raw-transition",
    re: /from\s+["']svelte\/transition["']/g,
    why: "§7 — transitions come from utils/motion.ts so every surface shares one clock",
    allow: ["utils/motion.ts"],
  },
  {
    id: "no-hidden-scrollbar",
    re: /scrollbar-width:\s*none|::-webkit-scrollbar\s*\{\s*display:\s*none/g,
    why: "§5 — a pane that scrolls must say so; scrollbars are declared once in app.css",
  },
  {
    id: "no-partial-error-map",
    re: /Partial<Record<\s*ErrorKind/g,
    why: "§8 — every ErrorKind gets a rendering; a partial map hides the gap",
  },
];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return walk(full);
    if (!EXTS.has(path.extname(e.name)) || e.name.endsWith(".test.ts")) return [];
    return [full];
  });
}

// Prose about a banned utility is not a use of it — this codebase explains its
// rules in place, so `text-xs` and `hover:bg-…` appear inside the comments that
// ban them. Spans are tracked, not just opening lines: the quote that tripped
// this was the fourth line of a /* */ block.
function commentMask(lines) {
  let inBlock = false;
  return lines.map((line) => {
    const wasInBlock = inBlock;
    for (const m of line.matchAll(/\/\*|\*\/|<!--|-->/g)) {
      if (m[0] === "/*" || m[0] === "<!--") inBlock = true;
      else inBlock = false;
    }
    return wasInBlock || inBlock || /^\s*(?:\/\/|\*)/.test(line);
  });
}

function scan(file) {
  const rel = path.relative(path.dirname(SRC), file);
  const lines = fs.readFileSync(file, "utf-8").split("\n");
  const isComment = commentMask(lines);
  const findings = [];

  for (const rule of RULES) {
    if (rule.allow?.some((frag) => rel.includes(frag))) continue;
    if (rule.only && !rule.only.some((frag) => `/${rel}`.includes(frag))) continue;

    for (const [i, line] of lines.entries()) {
      const waiver = `design-check-ignore ${rule.id}`;
      if (line.includes(waiver) || lines[i - 1]?.includes(waiver)) continue;
      if (isComment[i]) continue;
      if (rule.skipLine?.test(line)) continue;
      for (const m of line.matchAll(rule.re)) {
        findings.push({ rule: rule.id, file: rel, line: i + 1, match: m[0].trim(), why: rule.why });
      }
    }
  }
  return findings;
}

const json = process.argv.includes("--json");
const target = process.argv.find((a) => !a.startsWith("--") && a !== process.argv[0] && a !== process.argv[1]);
const root = target ? path.resolve(target) : SRC;
const files = fs.statSync(root).isDirectory() ? walk(root) : [root];
const findings = files.flatMap(scan);

if (json) {
  console.log(JSON.stringify(findings, null, 2));
} else if (findings.length === 0) {
  console.log(`design-check: ${files.length} files clean against DESIGN.md`);
} else {
  const byRule = new Map();
  for (const f of findings) byRule.set(f.rule, [...(byRule.get(f.rule) ?? []), f]);
  for (const [rule, hits] of byRule) {
    console.error(`\n  ${rule} — ${hits[0].why}`);
    for (const h of hits) console.error(`    ${h.file}:${h.line}  ${h.match}`);
  }
  console.error(`\ndesign-check: ${findings.length} finding(s) in ${byRule.size} rule(s)\n`);
}

process.exit(findings.length > 0 ? 1 : 0);
