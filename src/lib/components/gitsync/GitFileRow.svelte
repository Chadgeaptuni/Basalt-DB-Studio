<script lang="ts">
  import Plus from "@lucide/svelte/icons/plus";
  import Minus from "@lucide/svelte/icons/minus";
  import Undo2 from "@lucide/svelte/icons/undo-2";
  import IconButton from "$lib/components/ui/IconButton.svelte";
  import { stateLayerPill, focusRing } from "$lib/components/ui/stateLayer";
  import type { FileEntry } from "$lib/api/gitsync";

  // One changed file. Clicking the row shows its diff; the trailing controls act
  // on it. They appear on hover and on `focus-within`, so the row is not a
  // pointer-only affordance (DESIGN §7).
  interface Props {
    entry: FileEntry;
    /** Staged rows unstage; unstaged rows stage. Conflicted rows do neither. */
    staged: boolean;
    selected: boolean;
    busy: boolean;
    onselect: () => void;
    ontoggle: () => void;
    ondiscard: () => void;
  }
  let { entry, staged, selected, busy, onselect, ontoggle, ondiscard }: Props = $props();

  // One letter, in the role its meaning already has — the same vocabulary git
  // uses in `status --short`, so it transfers straight from the terminal.
  const BADGE: Record<FileEntry["state"], { letter: string; tone: string }> = {
    added: { letter: "A", tone: "text-ok" },
    modified: { letter: "M", tone: "text-warn" },
    deleted: { letter: "D", tone: "text-error" },
    renamed: { letter: "R", tone: "text-primary" },
    untracked: { letter: "U", tone: "text-on-surface-muted" },
    conflicted: { letter: "!", tone: "text-error" },
  };

  const badge = $derived(BADGE[entry.state]);
  // Directory dimmed, filename bright: a list of `connections/…` rows is scanned
  // by its last segment, and an even-weight path buries it.
  const cut = $derived(entry.path.lastIndexOf("/") + 1);
</script>

<div class="group flex h-8 items-center gap-1 pr-1 {selected ? 'bg-surface-container-high' : ''}">
  <button
    type="button"
    onclick={onselect}
    title={entry.path}
    class="flex h-full min-w-0 flex-1 items-center gap-2 pl-2 text-left {stateLayerPill}
      {focusRing}"
  >
    <span class="w-3 shrink-0 text-center text-data {badge.tone}">{badge.letter}</span>
    <span class="min-w-0 flex-1 truncate text-data">
      <span class="text-on-surface-muted">{entry.path.slice(0, cut)}</span><span
        class="text-on-surface-variant">{entry.path.slice(cut)}</span
      >
    </span>
  </button>

  {#if entry.state !== "conflicted"}
    <div
      class="flex shrink-0 items-center opacity-0 transition-opacity duration-200 ease-standard
        group-hover:opacity-100 focus-within:opacity-100"
    >
      {#if !staged}
        <IconButton
          icon={Undo2}
          title="Discard changes"
          size="sm"
          tone="danger"
          disabled={busy}
          onclick={ondiscard}
        />
      {/if}
      <IconButton
        icon={staged ? Minus : Plus}
        title={staged ? "Unstage" : "Stage"}
        size="sm"
        disabled={busy}
        onclick={ontoggle}
      />
    </div>
  {/if}
</div>
