<script lang="ts">
  import { keyboard } from "$lib/utils/keyboard";

  // One <kbd> per key inside a group — the HTML-spec shape for a chord, and it
  // keeps modifiers legible where the label is a word ("Ctrl Shift F") rather
  // than one long string in a single box. Sizing is uniform so a row of
  // shortcuts lines up (DESIGN §6).
  //
  // No "+" between the keys: each one is already its own bordered box, so the
  // separator restates what the boxes show — and at four boxes ("⌘ + ⇧ + ↵")
  // there is more punctuation on the row than key. `keyboard.label()` keeps its
  // separator, because in a plain-text tooltip there are no boxes doing that job.
  interface Props {
    combo: string;
  }
  let { combo }: Props = $props();

  const keys = $derived(keyboard.keys(combo));
</script>

<kbd class="inline-flex items-center gap-1" title={keyboard.label(combo)}>
  {#each keys as key, i (i)}
    <kbd
      class="inline-flex h-4 min-w-4 items-center justify-center rounded-xs border border-outline-variant
        bg-surface-container-high px-1 text-label-sm leading-none text-on-surface-muted"
    >
      {key}
    </kbd>
  {/each}
</kbd>
