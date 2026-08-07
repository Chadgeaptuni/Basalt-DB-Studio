import { describe, expect, it } from "vitest";
import { contrastRatio, poleFor, resolveColor, toHex } from "./contrast";

describe("resolveColor", () => {
  it("reads both hex forms", () => {
    expect(resolveColor("#fff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(resolveColor("#1e242e")).toEqual({ r: 0x1e, g: 0x24, b: 0x2e });
  });

  it("blends a color-mix in gamma-encoded sRGB", () => {
    // 50% black into white is the midpoint of the channel values, not of the
    // linear-light luminance — `in srgb` interpolates the encoded channels.
    expect(toHex(resolveColor("color-mix(in srgb, #000000 50%, #ffffff)")!)).toBe("#808080");
  });

  it("infers the second percentage from the first", () => {
    expect(toHex(resolveColor("color-mix(in srgb, #ffffff 25%, #000000)")!)).toBe("#404040");
  });

  // themeTokens nests these: a container is a mix of a panel that is itself a mix.
  it("resolves nested mixes", () => {
    const nested = "color-mix(in srgb, color-mix(in srgb, #ffffff 50%, #000000) 50%, #000000)";
    expect(toHex(resolveColor(nested)!)).toBe("#404040");
  });

  it("returns null for a form it cannot resolve", () => {
    expect(resolveColor("rgb(1 2 3)")).toBeNull();
    expect(resolveColor("var(--surface)")).toBeNull();
    expect(resolveColor("color-mix(in oklch, #fff 50%, #000)")).toBeNull();
  });
});

describe("contrastRatio", () => {
  it("spans 1…21", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#777777", "#777777")).toBeCloseTo(1, 5);
  });

  it("is symmetric", () => {
    expect(contrastRatio("#123456", "#abcdef")).toBeCloseTo(
      contrastRatio("#abcdef", "#123456")!,
      10,
    );
  });

  it("is null when either side is unresolvable", () => {
    expect(contrastRatio("var(--x)", "#ffffff")).toBeNull();
  });
});

describe("poleFor", () => {
  // The reason poleFor measures instead of thresholding: this olive reads as a
  // "dark" colour but black beats white on it by better than 2×.
  it("picks black on a mid-tone accent white would fail", () => {
    const olive = resolveColor("#8da101")!;
    expect(poleFor(olive)).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("picks white on a deep surface", () => {
    expect(poleFor(resolveColor("#16161e")!)).toEqual({ r: 255, g: 255, b: 255 });
  });
});
