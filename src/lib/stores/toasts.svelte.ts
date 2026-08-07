// Global toast service (DESIGN §9). One ToastHost renders `toasts.items`; call
// sites only ever call `toast.success|error|info` — never build toast markup.

import type { ApiError } from "$lib/api/client";
import { presentError } from "$lib/utils/errorPresentation";
import { copyText } from "$lib/utils/copy";

export type ToastKind = "success" | "error" | "info";

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  action?: ToastAction;
  sticky: boolean;
}

interface ToastOpts {
  action?: ToastAction;
  /** Stay until dismissed. Defaults true when an action is present. */
  sticky?: boolean;
  durationMs?: number;
}

let seq = 0;
const items = $state<Toast[]>([]);

function dismiss(id: number): void {
  const i = items.findIndex((t) => t.id === id);
  if (i !== -1) items.splice(i, 1);
}

function push(kind: ToastKind, message: string, opts: ToastOpts = {}): number {
  const id = ++seq;
  const sticky = opts.sticky ?? Boolean(opts.action);
  items.push({ id, kind, message, action: opts.action, sticky });
  if (!sticky) {
    const duration = opts.durationMs ?? (kind === "error" ? 8000 : 4000);
    setTimeout(() => dismiss(id), duration);
  }
  return id;
}

export const toasts = {
  get items() {
    return items;
  },
  dismiss,
};

/**
 * The one way a caught ApiError becomes a toast (DESIGN §8). The headline is the
 * kind's own words rather than the raw backend string, and every error toast
 * carries "Copy details" so it is never a dead end.
 *
 * `internal` sticks until dismissed — it is the kind that means "this is a bug",
 * and the user needs time to copy it. Everything else auto-dismisses.
 */
function fromError(e: unknown, context?: string): number {
  const err = e as ApiError;
  const { title } = presentError(err.kind);
  return push("error", context ? `${context}: ${title}` : title, {
    sticky: err.kind === "internal",
    action: {
      label: "Copy details",
      run: () => void copyText(`${err.kind}: ${err.message}`),
    },
  });
}

export const toast = {
  success: (message: string, opts?: ToastOpts) => push("success", message, opts),
  error: (message: string, opts?: ToastOpts) => push("error", message, opts),
  info: (message: string, opts?: ToastOpts) => push("info", message, opts),
  fromError,
};
