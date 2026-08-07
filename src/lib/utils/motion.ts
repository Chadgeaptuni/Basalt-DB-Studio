// Shared enter/exit transitions for transient surfaces (modals, menus, toasts).
// Declared once (code-quality rule 6); every overlay consumes these, never rolls
// its own. Timing follows DESIGN §7: micro fade 100 ms, modal/menu fade-scale
// ≤120 ms. Svelte transitions are JS-driven, so the app.css
// `prefers-reduced-motion` rule (CSS-only) does NOT cover them — we honor it here
// by collapsing the duration to 0.
import {
  fade,
  scale,
  slide,
  type FadeParams,
  type ScaleParams,
  type SlideParams,
} from "svelte/transition";

const reduced = (): boolean =>
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function uiFade(node: Element, params: FadeParams = {}) {
  return fade(node, { duration: reduced() ? 0 : 100, ...params });
}

export function uiScale(node: Element, params: ScaleParams = {}) {
  return scale(node, { duration: reduced() ? 0 : 120, start: 0.97, ...params });
}

// Collapse along an axis — used for tab open/close (`axis: "x"`). DESIGN §7.
export function uiSlide(node: Element, params: SlideParams = {}) {
  return slide(node, { duration: reduced() ? 0 : 130, ...params });
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
export function fadeThroughIn(node: Element, params: FadeParams = {}) {
  const off = reduced();
  return fade(node, {
    duration: off ? 0 : FADE_THROUGH_IN,
    delay: off ? 0 : FADE_THROUGH_OUT,
    ...params,
  });
}

export function fadeThroughOut(node: Element, params: FadeParams = {}) {
  return fade(node, { duration: reduced() ? 0 : FADE_THROUGH_OUT, ...params });
}
