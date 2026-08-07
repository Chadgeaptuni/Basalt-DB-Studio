// Every transition in the app, declared here (code-quality rule 6). Timing and
// curves follow DESIGN §7; no surface rolls its own.
//
// Svelte transitions are JS-driven, so app.css's `prefers-reduced-motion` block
// — which reaches CSS transitions and animations — does NOT cover them. Worse
// than not covering them: it would clamp the generated keyframes to 0.01ms while
// Svelte's own timer still held the node for the full duration, leaving an
// invisible element on screen. Every helper collapses its own duration instead.
//
// All of them describe motion with `css` rather than `tick`, so Svelte emits a
// real `@keyframes` animation the compositor can run, instead of writing inline
// styles from a rAF loop on the main thread.
import {
  fade,
  slide,
  type FadeParams,
  type SlideParams,
  type TransitionConfig,
} from "svelte/transition";

const reduced = (): boolean =>
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const ms = (n: number): number => (reduced() ? 0 : n);

// ── Easing ───────────────────────────────────────────────────────────────────

// The two curves app.css hands to CSS transitions, evaluated in JS.
//
// Without these, transitions run on svelte/easing's defaults — `fade` is
// **linear** — so an overlay arrives on a different curve from the state layer
// of the control that opened it. That mismatch is most of what reads as stiff:
// nothing in the app decelerates the same way twice.
//
// The control points are duplicated from app.css because Tailwind needs them
// there as literal CSS. `motion.test.ts` parses app.css and fails if they drift.
export const EASE_STANDARD = [0.2, 0, 0, 1] as const;
export const EASE_EMPHASIZED = [0.05, 0.7, 0.1, 1] as const;

type Curve = readonly [number, number, number, number];

/**
 * `cubic-bezier(x1, y1, x2, y2)` as an easing function, solved by bisection on x.
 *
 * Bisection rather than Newton-Raphson: both curves here leave the origin nearly
 * flat (`emphasized` at a slope of 0.15), which is exactly where Newton is least
 * stable, and 20 halvings resolve t to under 1e-6 — finer than a 60 fps frame can
 * show — for a handful of multiplications per frame per animating element.
 */
export function cubicBezier([x1, y1, x2, y2]: Curve): (t: number) => number {
  // The cubic with P0 = (0,0) and P3 = (1,1), in Horner form.
  const axis = (a: number, b: number, t: number): number =>
    (((1 - 3 * b + 3 * a) * t + (3 * b - 6 * a)) * t + 3 * a) * t;

  return (x: number): number => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0;
    let hi = 1;
    let t = x;
    for (let i = 0; i < 20; i++) {
      if (axis(x1, x2, t) < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return axis(y1, y2, t);
  };
}

const standard = cubicBezier(EASE_STANDARD);
const emphasized = cubicBezier(EASE_EMPHASIZED);

// ── Durations ────────────────────────────────────────────────────────────────

// M3's duration tokens at this app's density. Two rules run through all of them.
//
// **An exit is shorter than its entrance.** An entrance is the app answering;
// an exit is the app getting out of the way, and one that takes as long as the
// entrance reads as lag. This is why the pairs below are pairs — Svelte's
// `transition:` directive reuses one config for both directions, so an
// asymmetric surface uses `in:`/`out:` instead.
//
// **Nothing exceeds 300 ms** (DESIGN §7), and the bigger the surface, the longer
// it may take: a menu is 150 ms because it appears under the cursor, a side sheet
// 240 ms because it crosses its own width.
const MS = {
  micro: 100,
  popIn: 150,
  popOut: 100,
  dialogIn: 220,
  dialogOut: 140,
  sheetIn: 240,
  sheetOut: 160,
  panelIn: 200,
  panelOut: 150,
  toastIn: 200,
  toastOut: 130,
} as const;

// ── Surfaces ─────────────────────────────────────────────────────────────────

/** Micro fade, symmetric: scrims, tooltips, anything nobody is waiting on. */
export function uiFade(node: Element, params: FadeParams = {}): TransitionConfig {
  return fade(node, { duration: ms(MS.micro), easing: standard, ...params });
}

const POP_SCALE = 0.96;

const pop = (t: number): string =>
  `opacity:${t};transform:scale(${POP_SCALE + (1 - POP_SCALE) * t});` +
  // bits-ui writes the corner nearest the trigger into this property, so the
  // popup grows out of the control that opened it rather than out of its own
  // middle. Falls back to `center` for anything not anchored by bits-ui.
  `transform-origin:var(--bits-floating-transform-origin, center)`;

/** Anchored popups: menus, dropdowns, the select listbox, the connection popover. */
export function popIn(_node: Element): TransitionConfig {
  return { duration: ms(MS.popIn), easing: emphasized, css: pop };
}

export function popOut(_node: Element): TransitionConfig {
  return { duration: ms(MS.popOut), easing: standard, css: pop };
}

const DIALOG_SCALE = 0.96;

const dialog = (t: number): string =>
  `opacity:${t};transform:scale(${DIALOG_SCALE + (1 - DIALOG_SCALE) * t})`;

/** Centre dialogs. Scales the frame, never the centring translate around it. */
export function dialogIn(_node: Element): TransitionConfig {
  return { duration: ms(MS.dialogIn), easing: emphasized, css: dialog };
}

export function dialogOut(_node: Element): TransitionConfig {
  return { duration: ms(MS.dialogOut), easing: standard, css: dialog };
}

/**
 * Edge sheets. Translate, never a width collapse: a sheet that animates its own
 * width reflows its header and body on every frame, and the squash is visible.
 * `translateX` moves a composited layer and leaves the content laid out once.
 */
export function sheetIn(_node: Element): TransitionConfig {
  return {
    duration: ms(MS.sheetIn),
    easing: emphasized,
    css: (_t, u) => `transform:translateX(${u * 100}%)`,
  };
}

export function sheetOut(_node: Element): TransitionConfig {
  return {
    duration: ms(MS.sheetOut),
    easing: standard,
    css: (_t, u) => `transform:translateX(${u * 100}%)`,
  };
}

/**
 * The side panel opening and closing. This one *must* animate width — the main
 * area beside it has to give up the space — so the cost is contained instead:
 * the panel clips, and its contents are pinned to the panel's resting width, so
 * the subtree is laid out once and only the outer box changes each frame.
 * Without that pin, a schema tree of several hundred rows reflows every frame.
 */
export function panelIn(node: Element): TransitionConfig {
  const width = parseFloat(getComputedStyle(node).width) || 0;
  return {
    duration: ms(MS.panelIn),
    easing: emphasized,
    css: (t) => `width:${t * width}px;opacity:${t}`,
  };
}

export function panelOut(node: Element): TransitionConfig {
  const width = parseFloat(getComputedStyle(node).width) || 0;
  return {
    duration: ms(MS.panelOut),
    easing: standard,
    css: (t) => `width:${t * width}px;opacity:${t}`,
  };
}

const TOAST_RISE = 8;

/** Snackbars: a short rise on the way in, a plain fade on the way out. */
export function toastIn(_node: Element): TransitionConfig {
  return {
    duration: ms(MS.toastIn),
    easing: emphasized,
    css: (t, u) => `opacity:${t};transform:translateY(${u * TOAST_RISE}px)`,
  };
}

export function toastOut(_node: Element): TransitionConfig {
  return { duration: ms(MS.toastOut), easing: standard, css: (t) => `opacity:${t}` };
}

/**
 * Collapse along an axis — the tab strip opening and closing a tab. The one
 * place a size animation is the point: the strip's other tabs have to slide over
 * to make room, which is the whole cue that a tab was added.
 */
export function uiSlide(node: Element, params: SlideParams = {}): TransitionConfig {
  return slide(node, { duration: ms(MS.popIn), easing: standard, ...params });
}

// M3 fade-through, for a surface whose *content* is replaced rather than moved —
// the nav rail swapping panels. Asymmetric on purpose: the outgoing panel leaves
// quickly so the two never overlap for long, and the incoming one takes its time.
// No slide; a panel that flies in from the side reads as navigation, and the rail
// has not navigated anywhere.
const FADE_THROUGH_OUT = 90;
const FADE_THROUGH_IN = 210;

/** The incoming half. Waits out the outgoing half so the call site only has to
 *  name the two ends, not sequence them. */
export function fadeThroughIn(node: Element, params: FadeParams = {}): TransitionConfig {
  const off = reduced();
  return fade(node, {
    duration: off ? 0 : FADE_THROUGH_IN,
    delay: off ? 0 : FADE_THROUGH_OUT,
    easing: standard,
    ...params,
  });
}

export function fadeThroughOut(node: Element, params: FadeParams = {}): TransitionConfig {
  return fade(node, { duration: ms(FADE_THROUGH_OUT), easing: standard, ...params });
}
