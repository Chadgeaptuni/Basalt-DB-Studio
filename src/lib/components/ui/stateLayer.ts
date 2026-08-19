// M3 state layer (DESIGN §7), declared once — no component reimplements it and
// no call site hand-writes a hover colour.
//
// The layer is a translucent wash of the *content* colour (`bg-current`) over the
// container, so one class string works on every variant: filled, tonal, outlined
// and text all get the right overlay without knowing their own background.
//
// `isolate` + `-z-10` keeps the pseudo-element above the element's own background
// but below its text.

const LAYER =
  "before:pointer-events-none before:absolute before:-z-10 before:bg-current " +
  "before:opacity-0 before:transition-opacity before:duration-200 before:ease-standard";

// `disabled:pointer-events-none` used to stand in for the last rule here. It also
// took the control out of hit testing, so a disabled button reported its
// container's cursor and app.css's `not-allowed` never rendered on it. The click
// was never what that class was holding back — the `disabled` attribute blocks
// that on its own — so what it was really doing, keeping the hover overlay off,
// is now what it says. `disabled:hover:` is one condition deeper than `hover:`,
// so it wins wherever Tailwind orders the two.
const OPACITY =
  "hover:before:opacity-[0.08] active:before:opacity-[0.10] " +
  "disabled:opacity-[0.38] disabled:hover:before:opacity-0";

/**
 * Hover 8% / pressed 10%, clipped to the element's own shape. For controls that
 * are their own container: buttons, icon buttons, chips, menu rows, tabs.
 */
export const stateLayer =
  `relative isolate overflow-hidden ${LAYER} before:inset-0 ${OPACITY}`;

/**
 * The same layer drawn as a `rounded-full` pill inset from the row edge, for rows
 * that span a full-width container: list rows, tree rows, nav rail items.
 *
 * The inset is what makes a row read as Material rather than as a table — a
 * full-bleed rectangle hover is the thing that made the old UI look like a
 * spreadsheet. No `overflow-hidden`: the pill sets its own radius, and clipping
 * would cut off a focus ring drawn outside the row.
 */
export const stateLayerPill =
  `relative isolate ${LAYER} before:inset-x-1 before:inset-y-0.5 before:rounded-full ${OPACITY}`;

/**
 * The same layer, driven by an ancestor marked `group` instead of by its own
 * hover. For composite controls where the hit target is the whole block but the
 * layer belongs to one child — the nav rail item, whose 72×56 block is clickable
 * while M3 draws the layer on its 56×32 indicator pill.
 */
export const stateLayerGroup =
  `relative isolate overflow-hidden ${LAYER} before:inset-0 ` +
  "group-hover:before:opacity-[0.08] group-active:before:opacity-[0.10]";

/** Focus ring is additive to the layer — never a replacement (DESIGN §7). */
export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-1";
