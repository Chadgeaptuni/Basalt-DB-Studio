// The rail's destinations, in rail order. One catalogue so the rail, the panel
// header and the keyboard shortcuts can never disagree about what exists.
import Boxes from "@lucide/svelte/icons/boxes";
import BookMarked from "@lucide/svelte/icons/bookmark";
import HistoryIcon from "@lucide/svelte/icons/history";
import GitBranch from "@lucide/svelte/icons/git-branch";
import type { IconComponent } from "$lib/components/ui/icon";
import type { PanelId } from "$lib/stores/panel.svelte";

export interface Destination {
  id: PanelId;
  label: string;
  icon: IconComponent;
}

export const DESTINATIONS: Destination[] = [
  { id: "schema", label: "Schema", icon: Boxes },
  { id: "queries", label: "Queries", icon: BookMarked },
  { id: "history", label: "History", icon: HistoryIcon },
  { id: "git", label: "Git", icon: GitBranch },
];

export const destinationOf = (id: PanelId): Destination =>
  DESTINATIONS.find((d) => d.id === id)!;
