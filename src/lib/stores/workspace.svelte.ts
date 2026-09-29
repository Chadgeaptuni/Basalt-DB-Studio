import { editorTabs } from "./tabs.svelte";
import { connections } from "./connections.svelte";
import { debounce } from "$lib/utils/debounce";

// What the window held when it closed — the open SQL tabs with their drafts, and
// which connections were open — so a relaunch picks up where it left off. Per
// machine, in localStorage like the theme and zoom; never in the config dir.

const KEY = "basalt.workspace";

interface Saved {
  tabs: { sql: string; savedPath: string | null; title: string }[];
  active: number;
  connected: string[];
  activeProfile: string | null;
}

function snapshot(): Saved {
  // Table tabs are views of live data, reopened in a click; a draft is not.
  const sqlTabs = editorTabs.list.filter((t) => t.kind === "sql");
  return {
    tabs: sqlTabs.map((t) => ({ sql: t.sql, savedPath: t.savedPath, title: t.title })),
    active: sqlTabs.findIndex((t) => t.id === editorTabs.active?.id),
    connected: connections.profiles
      .filter((p) => connections.statusFor(p.id).status === "connected")
      .map((p) => p.id),
    activeProfile: connections.active?.profileId ?? null,
  };
}

function read(): Saved | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "null") as Saved | null;
  } catch {
    return null;
  }
}

/** Restores the last workspace, then keeps it saved. Called once at startup. */
export async function restoreWorkspace(): Promise<void> {
  const saved = read();
  if (saved) {
    const ids = saved.tabs.map((t) =>
      t.savedPath ? editorTabs.openSaved(t.savedPath, t.title, t.sql) : editorTabs.open(t.sql),
    );
    if (ids[saved.active]) editorTabs.select(ids[saved.active]);

    await connections.load();
    // Only what opens without asking: a SQLite file, or a saved password. The
    // rest restores disconnected rather than greeting the user with a prompt.
    const reopen = connections.profiles.filter(
      (p) => saved.connected.includes(p.id) && (p.engine === "sqlite" || p.secretRef),
    );
    await Promise.all(reopen.map((p) => connections.connect(p.id, false)));
    if (saved.activeProfile) {
      const session = connections.statusFor(saved.activeProfile).session;
      if (session) connections.setActive(session);
    }
  }

  const persist = debounce(() => localStorage.setItem(KEY, JSON.stringify(snapshot())), 500);
  $effect.root(() => {
    $effect(() => {
      snapshot();
      persist();
    });
  });
}
