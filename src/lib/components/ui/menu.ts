// Every floating list of choices in the app, declared once (DESIGN §6):
// `ContextMenu`, `DropdownMenu`, `Select`'s listbox and the connection popover.
// They differ only in what anchors them and what a row means — bits-ui already
// solves anchoring, focus and dismissal per trigger — so what they share is the
// container, the row metrics and the row content, and that is all this module
// owns. A popup that writes its own `rounded-md border … shadow-e2` is how one
// app ends up with four dropdowns that don't match.

import type { IconComponent } from "./icon";

export interface MenuItem {
  label: string;
  icon?: IconComponent;
  /** Registry spec (see keyboard.ts), rendered right-aligned as a `Kbd`. */
  combo?: string;
  danger?: boolean;
  disabled?: boolean;
  /** Marks the current value in a menu that behaves like a choice. */
  checked?: boolean;
  onselect: () => void;
}

/**
 * The floating container itself — the one that says "this is over the layout,
 * not part of it" (DESIGN §2: the only job a shadow has). Carries no size and no
 * padding, because a menu, a listbox and a popover holding its own list and
 * footer want different ones.
 *
 * `app-zoom` because all four of these are portalled onto `<body>`, outside the
 * zoomed `#app`. It belongs on this element and not on bits-ui's positioning
 * wrapper — see the utility in app.css for what zooming the wrapper does to
 * floating-ui's offsets.
 */
export const POPOVER_SURFACE =
  "app-zoom z-50 rounded-md border border-outline-variant bg-surface-container-high " +
  "shadow-e2 outline-none";

/** The container as a menu: wide enough to be one, padded for a run of rows. */
export const MENU_SURFACE = `${POPOVER_SURFACE} min-w-44 py-2`;

/**
 * A row in any of them: 36px on the density tier. `data-highlighted` is bits-ui's
 * hover/keyboard state and `data-disabled` its disabled one, so the row reacts to
 * pointer and keyboard through the same class with no second hover rule.
 */
export const MENU_ROW =
  "flex h-9 cursor-default items-center gap-2 px-3 text-label-md outline-none " +
  "transition-colors duration-200 ease-standard " +
  "data-[highlighted]:bg-surface-container-highest " +
  "data-[disabled]:pointer-events-none data-[disabled]:opacity-[0.38]";

export function menuRowClass(item: Pick<MenuItem, "danger">): string {
  return `${MENU_ROW} ${item.danger ? "text-error" : "text-on-surface-variant"}`;
}
