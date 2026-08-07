import { describe, it, expect } from "vitest";
import { THEME_SEEDS, THEME_VARIANTS, themeTokens, customSeed } from "./themeData";
import { AA_BODY, contrastRatio, resolveColor } from "$lib/utils/contrast";

// The U6 contrast gate: every text token, on every surface it is drawn on, in
// every palette × variant. Before this ran, the light variants of the borrowed
// palettes (Nord, Dracula, Tokyo Night, Everforest…) put syntax colours and
// secondary text under 2:1 — their accents were authored for a dark background
// and simply reused. 493 of the pairs below failed; `readable()` in themeData
// closed all of them.
//
// Foreground → the surfaces it can appear over. A token is only as legible as
// its worst pairing, so each one lists every background it really lands on.
const TEXT_PAIRS: [fg: string, bgs: string[]][] = [
  ["--on-surface", [
    "--surface", "--surface-container-low", "--surface-container",
    "--surface-container-high", "--surface-container-highest",
    "--grid-row-alt", "--grid-edited", "--grid-header-bg", "--grid-sel",
  ]],
  ["--on-surface-variant", [
    "--surface", "--surface-container-low", "--surface-container",
    "--surface-container-high", "--surface-container-highest",
  ]],
  ["--on-surface-muted", [
    "--surface", "--surface-container-low", "--surface-container",
    "--surface-container-high", "--surface-container-highest",
  ]],
  ["--primary", ["--surface", "--surface-container", "--surface-container-high"]],
  ["--on-primary", ["--primary"]],
  ["--on-primary-container", ["--primary-container"]],
  ["--on-secondary-container", ["--secondary-container"]],
  ["--error", ["--surface", "--surface-container", "--surface-container-high"]],
  ["--on-error", ["--error"]],
  ["--on-error-container", ["--error-container"]],
  ["--ok", ["--surface", "--surface-container", "--surface-container-high"]],
  ["--warn", ["--surface", "--surface-container", "--surface-container-high"]],
  ["--grid-null", ["--surface", "--grid-row-alt", "--grid-edited", "--grid-sel"]],
  ["--syntax-kw", ["--surface", "--surface-container-low"]],
  ["--syntax-str", ["--surface", "--surface-container-low"]],
  ["--syntax-num", ["--surface", "--surface-container-low"]],
  ["--syntax-comment", ["--surface", "--surface-container-low"]],
  ["--syntax-fn", ["--surface", "--surface-container-low"]],
  ["--syntax-ident", ["--surface", "--surface-container-low"]],
];

describe("theme contrast", () => {
  for (const seed of THEME_SEEDS) {
    for (const variant of THEME_VARIANTS) {
      it(`${seed.id} · ${variant} passes WCAG AA for body text`, () => {
        const tokens = themeTokens(seed, variant);
        for (const [fg, bgs] of TEXT_PAIRS) {
          for (const bg of bgs) {
            const ratio = contrastRatio(tokens[fg], tokens[bg]);
            // null means a token took a form the resolver doesn't know, which
            // would silently skip the check — fail rather than pass by default.
            expect(ratio, `${fg} on ${bg} is unresolvable`).not.toBeNull();
            expect(
              ratio,
              `${fg} on ${bg} in ${seed.id}/${variant} is ${ratio?.toFixed(2)}:1`,
            ).toBeGreaterThanOrEqual(AA_BODY);
          }
        }
      });
    }
  }

  it("resolves every emitted token to a real colour", () => {
    for (const seed of THEME_SEEDS) {
      for (const variant of THEME_VARIANTS) {
        for (const [name, value] of Object.entries(themeTokens(seed, variant))) {
          expect(resolveColor(value), `${seed.id}/${variant} ${name} = ${value}`).not.toBeNull();
        }
      }
    }
  });

  // `--outline` is the one foreground held to no text ratio, on purpose: it is a
  // 1px hairline. Forcing 4.5:1 onto it would turn every panel edge into a hard
  // border and undo the tonal depth model (DESIGN §2). Pinned so the exemption
  // stays a decision rather than an oversight.
  it("leaves hairlines below the text ratio", () => {
    const tokens = themeTokens(THEME_SEEDS[0], "dark");
    expect(contrastRatio(tokens["--outline"], tokens["--surface"])).toBeLessThan(AA_BODY);
  });

  // A user-authored palette gets the same guarantee as a built-in: the four
  // colours they pick expand through the same derivation.
  it("holds a hostile custom theme to AA as well", () => {
    const seed = customSeed("custom-x", "X", {
      primary: "#f0f0f0",
      surface: "#eeeeee",
      border: "#ededed",
      text: "#efefef", // near-invisible text on a near-identical surface
    });
    const tokens = themeTokens(seed, "light");
    for (const bg of ["--surface", "--surface-container", "--surface-container-high"]) {
      expect(contrastRatio(tokens["--on-surface"], tokens[bg])).toBeGreaterThanOrEqual(AA_BODY);
    }
  });
});
