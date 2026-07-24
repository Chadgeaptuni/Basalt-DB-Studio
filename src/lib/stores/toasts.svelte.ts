// Global toast service (DESIGN §9). One ToastHost renders `toasts.items`; call
// sites only ever call `toast.success|error|info` — never build toast markup.

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

export const toast = {
  success: (message: string, opts?: ToastOpts) => push("success", message, opts),
  error: (message: string, opts?: ToastOpts) => push("error", message, opts),
  info: (message: string, opts?: ToastOpts) => push("info", message, opts),
};
