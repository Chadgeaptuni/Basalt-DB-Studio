// Settings-dialog visibility, declared once (DESIGN §9). The rail opens it on
// General and the top bar's palette button opens it on Appearance — two surfaces
// in different subtrees, so neither can own the state and hand it to the other.
// Same shape as `palette.svelte.ts`.
//
// The tab lives here rather than in the component so the openers name a tab
// without importing the dialog.

export type SettingsTab = "general" | "appearance" | "shortcuts" | "about";

let tab = $state<SettingsTab | null>(null);

export const settingsDialog = {
  /** Null when closed; otherwise the tab to land on. */
  get tab(): SettingsTab | null {
    return tab;
  },

  // Self-references go through `settingsDialog`, not `this`: these are passed
  // straight to `onclick`, which detaches the receiver.
  open(next: SettingsTab = "general"): void {
    tab = next;
  },
  close(): void {
    tab = null;
  },
};
