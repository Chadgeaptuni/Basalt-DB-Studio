// The one catalogue of user-facing shortcuts (DESIGN §7). The Settings tab and
// the start panel both read it — a second hand-written copy is exactly how the
// previous list drifted from the bindings it claimed to document.
//
// `combos` are registry specs (see keyboard.ts), rendered through
// `keyboard.label()` so every key stays platform-correct; a row carries more
// than one only when the binding genuinely is a set (zoom, tab cycling).
import type { IconComponent } from "$lib/components/ui/icon";

import Play from "@lucide/svelte/icons/play";
import PlaySquare from "@lucide/svelte/icons/play-square";
import AlignLeft from "@lucide/svelte/icons/align-left";
import Save from "@lucide/svelte/icons/save";
import FilePlus from "@lucide/svelte/icons/file-plus";
import FileX from "@lucide/svelte/icons/file-x";
import Layers from "@lucide/svelte/icons/layers";
import PanelLeft from "@lucide/svelte/icons/panel-left";
import Search from "@lucide/svelte/icons/search";
import ZoomIn from "@lucide/svelte/icons/zoom-in";
import Move from "@lucide/svelte/icons/move";
import Edit3 from "@lucide/svelte/icons/edit-3";
import Eraser from "@lucide/svelte/icons/eraser";
import Copy from "@lucide/svelte/icons/copy";
import Maximize2 from "@lucide/svelte/icons/maximize-2";
import Undo from "@lucide/svelte/icons/undo";

export interface ShortcutItem {
  label: string;
  combos: string[];
  icon: IconComponent;
}

export interface ShortcutGroup {
  title: string;
  items: ShortcutItem[];
}

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "QUERY",
    items: [
      { label: "Run statement at cursor", combos: ["mod+enter"], icon: Play },
      { label: "Run full script", combos: ["mod+shift+enter"], icon: PlaySquare },
      { label: "Format SQL", combos: ["mod+shift+f"], icon: AlignLeft },
      { label: "Save active query", combos: ["mod+s"], icon: Save },
    ],
  },
  {
    title: "WORKSPACE",
    items: [
      { label: "New editor tab", combos: ["mod+t"], icon: FilePlus },
      { label: "Close editor tab", combos: ["mod+w"], icon: FileX },
      // Literal Ctrl on every platform, matching Workspace.svelte's binding.
      { label: "Previous / next tab", combos: ["ctrl+pageup", "ctrl+pagedown"], icon: Layers },
      { label: "Search tables, queries, actions", combos: ["mod+k"], icon: Search },
      { label: "Toggle side panel", combos: ["mod+b"], icon: PanelLeft },
      { label: "Zoom in / out / reset", combos: ["mod+=", "mod+-", "mod+0"], icon: ZoomIn },
    ],
  },
  {
    title: "DATA GRID (TABLE VIEW)",
    items: [
      {
        label: "Move cell selection",
        combos: ["arrowleft", "arrowright", "arrowup", "arrowdown"],
        icon: Move,
      },
      { label: "Edit selected cell", combos: ["enter"], icon: Edit3 },
      { label: "Set cell to NULL", combos: ["delete"], icon: Eraser },
      { label: "Copy cell", combos: ["mod+c"], icon: Copy },
      { label: "Inspect cell", combos: ["space"], icon: Maximize2 },
      { label: "Revert cell edit", combos: ["escape"], icon: Undo },
    ],
  },
];

/**
 * What the empty workspace lists. The grid keys are dropped because they need an
 * open table first, and `mod+k` because the top bar prints that binding on the
 * search control itself — the same key twice on one screen, a hand's width apart.
 * Filtered on the combo rather than the label: the binding is the row's identity,
 * and labels get reworded.
 */
export const STARTUP_SHORTCUT_GROUPS: ShortcutGroup[] = SHORTCUT_GROUPS.slice(0, 2).map(
  (group) => ({ ...group, items: group.items.filter((i) => !i.combos.includes("mod+k")) }),
);
