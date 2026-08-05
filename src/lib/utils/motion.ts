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
