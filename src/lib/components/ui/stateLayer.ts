// M3 state layer (DESIGN §7), declared once — no component reimplements it and
// no call site hand-writes a hover colour.
//
// The layer is a translucent wash of the *content* colour (`bg-current`) over the
// container, so one class string works on every variant: filled, tonal, outlined
// and text all get the right overlay without knowing their own background.
//
// `isolate` + `-z-10` keeps the pseudo-element above the element's own background
// but below its text.
//
// The layer carries its own radius (`before:rounded-[inherit]`) and nothing clips
// it. It used to be clipped by `overflow-hidden` on the parent, and in WebKit —
// Tauri's engine on macOS, which is why Chrome never showed it — an animating
// `-z-10` pseudo inside an `isolate` stacking context is composited for the
// transition, forcing the ancestor's rounded clip to be re-rasterized against it.
// The promote/rasterize/demote cycle ran at every transition boundary, so buttons
// flashed on hover-in, hover-out, press and release alike. `stateLayerPill` never
// did, because it was already built this way.

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
  `relative isolate ${LAYER} before:inset-0 before:rounded-[inherit] ${OPACITY}`;

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
  `relative isolate ${LAYER} before:inset-0 before:rounded-[inherit] ` +
  "group-hover:before:opacity-[0.08] group-active:before:opacity-[0.10]";

/**
 * The 8% wash as a plain background, full-bleed, for rows whose container
 * already draws their edges: the data grid's 28px rows, and rows inside a
 * divided/bordered list where the inset pill leaves a gap between the hover and
 * the divider above it — which reads as a hover that missed.
 *
 * A background rather than the pseudo layer because those are also the two cases
 * the pseudo cannot serve: `stateLayer` needs `overflow-hidden` to clip
 * `before:inset-0`, which would cut the offset focus ring off the selected cell
 * and, in WebKit, re-rasterizes the container's rounded clip on every
 * transition; and `stateLayerPill` needs vertical room the exempt 28px row does
 * not have (DESIGN §2's grid carve-out).
 *
 * Same 8% as every other hover, declared here so no row hand-picks it.
 */
export const stateLayerFlush = "transition-colors duration-200 ease-standard hover:bg-on-surface/8";

/** Focus ring is additive to the layer — never a replacement (DESIGN §7). */
export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-1";

/**
 * Outline → fill, for the one button whose click cannot be taken back: the
 * destructive confirm. It rests as an outline in `--error` so it does not read
 * as the dialog's default action, and fills with `--error` on hover or keyboard
 * focus — the escalation is visible before the click, not after it. The state
 * layer applies on top in both states, because `bg-current` follows the text
 * colour through the swap.
 *
 * Declared here rather than in `Button` for the same reason as the layers: this
 * is the one place a hover colour is written (DESIGN §7).
 */
export const destructiveFill =
  "border border-error text-error transition-colors duration-200 ease-standard " +
  "hover:bg-error hover:text-on-error focus-visible:bg-error focus-visible:text-on-error";
