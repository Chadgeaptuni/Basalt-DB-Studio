// The M3 menu surface, declared once (DESIGN §6). `ContextMenu` and
// `DropdownMenu` differ only in what anchors them — bits-ui already solves
// anchoring, focus and dismissal per trigger — so what they share is the surface,
// the row metrics and the row content, and that is all this module owns.

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

export const MENU_SURFACE =
  "z-50 min-w-44 rounded-md border border-outline-variant bg-surface-container-high " +
  "py-2 shadow-e2 outline-none";

/** 36px rows on the density tier; `data-highlighted` is bits-ui's hover/focus state. */
export function menuRowClass(item: Pick<MenuItem, "danger">): string {
  return (
    "flex h-9 cursor-default items-center gap-2 px-3 text-label-md outline-none " +
    "transition-colors duration-200 ease-standard " +
    "data-[highlighted]:bg-surface-container-highest " +
    "data-[disabled]:pointer-events-none data-[disabled]:opacity-[0.38] " +
    (item.danger ? "text-error" : "text-on-surface-variant")
  );
}
