// The single keyboard-shortcut registry (DESIGN §7). One window listener; every
// shortcut registers here. No component attaches its own global `keydown`.
//
// Specs use "mod" for the platform command key (⌘ on macOS, Ctrl elsewhere),
// e.g. "mod+b", "mod+shift+enter". register() returns an unsubscribe fn.

export type ShortcutHandler = (e: KeyboardEvent) => void;

const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = IS_MAC ? "meta" : "ctrl";
const MOD_ORDER = ["alt", "ctrl", "meta", "shift"] as const;

function canonical(spec: string): string {
  const mods = new Set<string>();
  let key = "";
  for (const raw of spec.toLowerCase().split("+")) {
    const p = raw.trim();
    if (p === "mod") mods.add(MOD);
    else if ((MOD_ORDER as readonly string[]).includes(p)) mods.add(p);
    else key = p;
  }
  return [...MOD_ORDER.filter((m) => mods.has(m)), key].join("+");
}

function fromEvent(e: KeyboardEvent): string {
  const mods: string[] = [];
  if (e.altKey) mods.push("alt");
  if (e.ctrlKey) mods.push("ctrl");
  if (e.metaKey) mods.push("meta");
  if (e.shiftKey) mods.push("shift");
  return [...mods, e.key.toLowerCase()].join("+");
}

// Named keys whose Title-Case form reads badly ("Pageup") or has a conventional
// glyph. Anything absent falls through to Title Case.
const KEY_LABELS: Record<string, string> = {
  enter: "↵",
  escape: "Esc",
  pageup: "PgUp",
  pagedown: "PgDn",
  delete: "Del",
  backspace: "⌫",
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
};

const registry = new Map<string, ShortcutHandler>();
let listening = false;

function onKeydown(e: KeyboardEvent): void {
  const handler = registry.get(fromEvent(e));
  if (handler) {
    e.preventDefault();
    handler(e);
  }
}

export const keyboard = {
  register(spec: string, run: ShortcutHandler): () => void {
    const key = canonical(spec);
    registry.set(key, run);
    if (!listening) {
      window.addEventListener("keydown", onKeydown);
      listening = true;
    }
    return () => {
      if (registry.get(key) === run) registry.delete(key);
    };
  },

  /** Human-readable form for Kbd / menus: "mod+shift+f" → "⌘⇧F" or "Ctrl+Shift+F". */
  label(spec: string): string {
    const parts = spec.toLowerCase().split("+").map((p) => p.trim());
    const out = parts.map((p) => {
      if (p === "mod") return IS_MAC ? "⌘" : "Ctrl";
      if (p === "shift") return IS_MAC ? "⇧" : "Shift";
      if (p === "alt") return IS_MAC ? "⌥" : "Alt";
      if (p === "ctrl") return IS_MAC ? "⌃" : "Ctrl";
      if (p === "meta") return IS_MAC ? "⌘" : "Win";
      return KEY_LABELS[p] ?? (p.length === 1 ? p.toUpperCase() : p.charAt(0).toUpperCase() + p.slice(1));
    });
    return IS_MAC ? out.join("") : out.join("+");
  },
};
