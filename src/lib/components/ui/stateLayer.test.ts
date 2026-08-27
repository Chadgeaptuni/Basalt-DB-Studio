import { describe, expect, it } from "vitest";
import {
  destructiveFill,
  stateLayer,
  stateLayerPill,
  stateLayerGroup,
  stateLayerFlush,
} from "./stateLayer";

// Regression: the pseudo-element layer used to be clipped by `overflow-hidden`
// on its own parent. In WebKit — the engine Tauri uses on macOS, but not the one
// Chrome tests — an animating negative-z-index pseudo inside an
// `isolation: isolate` stacking context gets composited for the transition, and
// the ancestor's rounded clip has to be re-rasterized against it. That promote /
// rasterize / demote cycle ran at every transition boundary, so a button flashed
// on hover-in, hover-out, press AND release.
//
// Bisected in Safari across 14 variants: removing the clip fixed it, and so did
// removing the negative z-index, the transition, or the pseudo itself. The clip
// is the one we can drop without losing the layer, because the pseudo can carry
// the radius itself — which is what `stateLayerPill` always did, and why rows
// never flashed while buttons did.
describe("state layer", () => {
  for (const [name, cls] of [
    ["stateLayer", stateLayer],
    ["stateLayerGroup", stateLayerGroup],
  ] as const) {
    describe(name, () => {
      it("does not clip the layer with overflow-hidden", () => {
        expect(cls).not.toContain("overflow-hidden");
      });

      it("gives the pseudo-element the parent's own radius instead", () => {
        expect(cls).toContain("before:rounded-[inherit]");
      });

      // The clip was load-bearing for stacking: `isolate` is what keeps a
      // `-z-10` pseudo above the parent's background rather than behind it. Drop
      // that and the wash disappears entirely (harness variant D).
      it("keeps the stacking context the negative z-index depends on", () => {
        expect(cls).toContain("isolate");
        expect(cls).toContain("before:-z-10");
      });
    });
  }

  it("leaves stateLayerPill on its own radius, as it always was", () => {
    expect(stateLayerPill).not.toContain("overflow-hidden");
    expect(stateLayerPill).toContain("before:rounded-full");
  });

  it("keeps stateLayerFlush free of a pseudo-element entirely", () => {
    expect(stateLayerFlush).not.toContain("before:");
    expect(stateLayerFlush).toContain("hover:bg-on-surface/8");
  });

  // The destructive confirm rests as an outline and fills on hover *or* keyboard
  // focus: a keyboard user gets the same escalation a mouse user does, and both
  // see it before the click rather than after.
  it("gives the destructive confirm an outline at rest and a fill on both", () => {
    expect(destructiveFill).toContain("border-error");
    expect(destructiveFill).toContain("text-error");
    expect(destructiveFill).toContain("hover:bg-error");
    expect(destructiveFill).toContain("focus-visible:bg-error");
    expect(destructiveFill).not.toContain("bg-error-container");
  });
});
