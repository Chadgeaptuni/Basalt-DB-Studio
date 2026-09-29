import type { ColumnSpec, DdlRequest } from "$lib/api/types";

// Routes the active DDL dialog (like the toast/confirm hosts). Form dialogs build
// a DdlRequest then hand off to the shared preview step. One DdlHost renders it.

export type DdlDialog =
  | { type: "newTable"; namespace: string }
  /** With `column`, edits that column instead of adding one. */
  | { type: "column"; namespace: string; table: string; column?: ColumnSpec }
  | { type: "createIndex"; namespace: string; table: string; columns: string[] }
  /** With `column`, renames that column instead of the table. */
  | { type: "rename"; namespace: string; table: string; column?: string }
  | { type: "preview"; request: DdlRequest };

let active = $state<DdlDialog | null>(null);

export const ddl = {
  get active() {
    return active;
  },
  open(dialog: DdlDialog): void {
    active = dialog;
  },
  preview(request: DdlRequest): void {
    active = { type: "preview", request };
  },
  close(): void {
    active = null;
  },
};
