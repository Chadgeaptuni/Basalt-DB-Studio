// M3 state layer (DESIGN §7), declared once — no primitive reimplements it.
//
// The layer is a translucent wash of the *content* colour (`bg-current`) over the
// container, so one class string works on every variant: filled, tonal, outlined
// and text all get the right overlay without knowing their own background.
//
// `isolate` + `-z-10` keeps the pseudo-element above the element's own background
// but below its text; `overflow-hidden` clips it to the pill/rounded shape.

const LAYER =
  "before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:bg-current " +
  "before:opacity-0 before:transition-opacity before:duration-200 before:ease-standard";

/** Hover 8% / pressed 10%, per M3. Apply to any interactive container. */
export const stateLayer =
  `relative isolate overflow-hidden ${LAYER} ` +
  "hover:before:opacity-[0.08] active:before:opacity-[0.10] " +
  "disabled:pointer-events-none disabled:opacity-[0.38]";

/** Focus ring is additive to the layer — never a replacement (DESIGN §7). */
export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-1";
