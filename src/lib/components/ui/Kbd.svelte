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
      <span aria-hidden="true" class="font-mono text-[10px] leading-none text-fg-2">+</span>
    {/if}
    <kbd
      class="inline-flex h-4 min-w-4 items-center justify-center rounded border border-border
        bg-bg-2 px-1 font-mono text-[10px] leading-none text-fg-2"
    >
      {key}
    </kbd>
  {/each}
</kbd>
