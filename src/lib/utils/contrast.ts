// WCAG 2.1 contrast over the token contract.
//
// `themeTokens()` emits two colour forms and only two: an authored `#rrggbb`,
// and `color-mix(in srgb, A p%, B)` where A or B may themselves be a mix. The
// browser resolves those; nothing else in the app can, which is why a theme
// could ship unreadable text and nobody would find out until they used it. This
// resolves the same two forms so the palettes can be measured — by the audit
// suite over all built-ins, and live by the custom-theme editor, which is the
// only place a user can author a palette we never got to check.

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Split on commas that are not inside parentheses (mixes nest). */
function splitTopLevel(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

/** One `color-mix` argument: a colour with an optional trailing percentage. */
function readStop(part: string): { color: string; pct: number | null } {
  const m = /^(.*?)\s+([\d.]+)%$/s.exec(part.trim());
  return m ? { color: m[1].trim(), pct: Number(m[2]) } : { color: part.trim(), pct: null };
}

function parseHex(v: string): Rgb | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  const n = Number.parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Resolve a token value to sRGB. Returns null for a form we don't emit. */
export function resolveColor(value: string): Rgb | null {
  const v = value.trim();
  const hex = parseHex(v);
  if (hex) return hex;

  const mix = /^color-mix\(\s*in\s+srgb\s*,(.*)\)$/is.exec(v);
  if (!mix) return null;

  const parts = splitTopLevel(mix[1]);
  if (parts.length !== 2) return null;

  const a = readStop(parts[0]);
  const b = readStop(parts[1]);
  const ca = resolveColor(a.color);
  const cb = resolveColor(b.color);
  if (!ca || !cb) return null;

  // CSS: a missing percentage is 100% minus the one that was given; when both
  // are absent each is 50%. We only ever emit the first form.
  const pa = a.pct ?? (b.pct === null ? 50 : 100 - b.pct);
  const pb = b.pct ?? 100 - pa;
  const total = pa + pb;
  if (total <= 0) return null;

  const w = pa / total;
  // `in srgb` interpolates the gamma-encoded channels, so this is a plain
  // channel-wise blend — no linearization here (that happens in luminance).
  return {
    r: ca.r * w + cb.r * (1 - w),
    g: ca.g * w + cb.g * (1 - w),
    b: ca.b * w + cb.b * (1 - w),
  };
}

/** WCAG 2.1 relative luminance. */
export function relativeLuminance(c: Rgb): number {
  const channel = (v: number): number => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
}

/** WCAG 2.1 contrast ratio between two resolved colours, 1…21. */
export function contrastOf(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Contrast between two token values. Returns null if either side isn't a colour
 * this can resolve — callers must treat that as "unknown", never as a pass.
 */
export function contrastRatio(fg: string, bg: string): number | null {
  const a = resolveColor(fg);
  const b = resolveColor(bg);
  return a && b ? contrastOf(a, b) : null;
}

export const BLACK: Rgb = { r: 0, g: 0, b: 0 };
export const WHITE: Rgb = { r: 255, g: 255, b: 255 };

/** Blend in gamma-encoded sRGB — the same space `color-mix(in srgb, …)` uses. */
export function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

export function toHex(c: Rgb): string {
  const byte = (v: number): string =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, "0");
  return `#${byte(c.r)}${byte(c.g)}${byte(c.b)}`;
}

/**
 * Black or white, whichever reads better on `bg`. Chosen by measuring both
 * rather than by a lightness threshold: the crossover sits at a luminance most
 * people guess wrong, and mid-tone accents (olive, teal) land right on it.
 */
export function poleFor(bg: Rgb): Rgb {
  return contrastOf(BLACK, bg) >= contrastOf(WHITE, bg) ? BLACK : WHITE;
}

/**
 * WCAG AA for normal text. Every text token is held to this, including the ones
 * that look like accents: at the density −2 tier the app's largest text role is
 * 18px/500, and WCAG's relaxed 3:1 tier does not begin until 18.66px bold or
 * 24px regular. There is no text in Basalt that qualifies for it.
 */
export const AA_BODY = 4.5;
