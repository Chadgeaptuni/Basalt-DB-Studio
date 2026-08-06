<script lang="ts">
  import { keyboard } from "$lib/utils/keyboard";

  // One <kbd> per key inside a group — the HTML-spec shape for a chord, and it
  // keeps modifiers legible where the label is a word ("Ctrl Shift F") rather
  // than one long string in a single box. Sizing is uniform so a row of
  // shortcuts lines up (DESIGN §6).
  interface Props {
    combo: string;
  }
  let { combo }: Props = $props();

  const keys = $derived(keyboard.keys(combo));
</script>

<kbd class="inline-flex items-center gap-0.5" title={keyboard.label(combo)}>
  {#each keys as key, i (i)}
    {#if i > 0}
      <span aria-hidden="true" class="text-label-sm leading-none text-on-surface-muted">+</span>
    {/if}
    <kbd
      class="inline-flex h-4 min-w-4 items-center justify-center rounded-xs border border-outline-variant
        bg-surface-container-high px-1 text-label-sm leading-none text-on-surface-muted"
    >
      {key}
    </kbd>
  {/each}
</kbd>
