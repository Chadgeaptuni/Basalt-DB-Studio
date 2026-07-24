import { editorTabs } from "./tabs.svelte";
import { savedQueries } from "./savedQueries.svelte";
import { toast } from "./toasts.svelte";

// Bridges the Ctrl+S / Save button (from anywhere) to the SaveQueryDialog host in
// App.svelte, without coupling the editor to the sidebar. If the active tab is
// already bound to a path, saving overwrites silently; otherwise the dialog asks
// for a folder-relative path first.

let dialogFor = $state<string | null>(null);

export const saveQuery = {
  get promptOpen() {
    return dialogFor !== null;
  },
  /** Save the active SQL tab; opens the name dialog only if it isn't bound yet. */
  async trigger(): Promise<void> {
    const tab = editorTabs.active;
    if (!tab || tab.kind !== "sql") return;
    if (tab.savedPath) {
      await savedQueries.save(tab.savedPath, tab.sql);
      toast.success(`Saved ${tab.savedPath}`);
    } else {
      dialogFor = tab.id;
    }
  },
  async confirmName(path: string): Promise<void> {
    const id = dialogFor;
    dialogFor = null;
    const tab = id ? editorTabs.find(id) : undefined;
    if (!tab) return;
    await savedQueries.save(path, tab.sql);
    editorTabs.markSaved(tab.id, path, path.split("/").pop() ?? path);
    toast.success(`Saved ${path}`);
  },
  cancel(): void {
    dialogFor = null;
  },
};
