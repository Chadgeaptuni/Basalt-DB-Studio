// Global confirm() service (DESIGN §9). One ConfirmDialogHost renders the active
// dialog; every destructive confirmation and backend `confirmationRequired`
// funnels through here — ConfirmDialog is never instantiated inline.

export type ConfirmVariant = "default" | "danger";

export interface ConfirmOpts {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
}

interface ActiveConfirm extends ConfirmOpts {
  id: number;
  resolve: (ok: boolean) => void;
}

let seq = 0;
let active = $state<ActiveConfirm | null>(null);

/** Resolves true on accept, false on cancel. A new confirm supersedes any open one. */
export function confirm(opts: ConfirmOpts): Promise<boolean> {
  return new Promise((resolve) => {
    if (active) active.resolve(false);
    active = { ...opts, id: ++seq, resolve };
  });
}

function settle(ok: boolean): void {
  if (!active) return;
  active.resolve(ok);
  active = null;
}

export const dialogs = {
  get active() {
    return active;
  },
  accept: () => settle(true),
  cancel: () => settle(false),
};
