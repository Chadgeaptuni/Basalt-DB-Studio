import { render } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import BrandMark from "./BrandMark.svelte";

function mark(props: Record<string, unknown> = {}): SVGSVGElement {
  const { container } = render(BrandMark, props);
  const svg = container.querySelector("svg");
  if (!svg) throw new Error("BrandMark rendered no svg");
  return svg;
}

describe("BrandMark", () => {
  // The whole point of inlining the mark instead of loading `/icon-mark.svg`: a
  // literal here is invisible until someone opens a light theme and finds the
  // logo gone. The asset keeps its fixed palette; this must never grow one.
  it("carries no colour of its own", () => {
    expect(mark().outerHTML).not.toMatch(/#[0-9a-f]{3}|rgb\(|hsl\(|oklch\(/i);
  });

  // Two roles, and only two — the surrounding text colour for the stone, the
  // accent for the lit slab and the inner hexagon. A theme repaints all of it by
  // changing those two tokens and nothing else.
  it("draws the stone in the inherited tone and the accent in --primary", () => {
    const paints = new Set(
      [...mark().querySelectorAll("[class]")]
        .flatMap((el) => (el.getAttribute("class") ?? "").split(/\s+/))
        .filter((c) => /^(fill|stroke)-/.test(c)),
    );

    // Exactly these — all three present, and no fourth paint anywhere.
    expect(paints).toEqual(new Set(["fill-current", "stroke-current", "fill-primary"]));
  });

  it("takes its tone from the caller, replacing the default outright", () => {
    expect(mark().getAttribute("class")).toBe("text-on-surface");
    expect(mark({ class: "text-on-surface-variant" }).getAttribute("class")).toBe(
      "text-on-surface-variant",
    );
  });

  it("stays out of the accessibility tree", () => {
    const svg = mark();
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("focusable", "false");
  });

  it("scales from one prop", () => {
    const svg = mark({ size: 22 });
    expect(svg).toHaveAttribute("width", "22");
    expect(svg).toHaveAttribute("height", "22");
    expect(svg).toHaveAttribute("viewBox", "0 0 256 256");
  });
});
