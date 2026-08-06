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

const OPACITY =
  "hover:before:opacity-[0.08] active:before:opacity-[0.10] " +
  "disabled:pointer-events-none disabled:opacity-[0.38]";

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

/** Focus ring is additive to the layer — never a replacement (DESIGN §7). */
export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-1";
