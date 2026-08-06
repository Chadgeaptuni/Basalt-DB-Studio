<script lang="ts" module>
  export interface Segment {
    value: string;
    label: string;
  }
</script>

<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import { stateLayer, focusRing } from "./stateLayer";

  // M3 single-select segmented button (DESIGN §6): 32px, one outlined pill split
  // into segments, the selected one filled with `--secondary-container` and marked
  // by a check. For 2–5 exclusive options that must stay visible — anything longer
  // or hideable is a `Select`.
  interface Props {
    segments: Segment[];
    value: string;
    label: string;
    onchange: (value: string) => void;
  }
  let { segments, value, label, onchange }: Props = $props();
</script>

<div
  role="group"
  aria-label={label}
  class="inline-flex h-8 items-stretch overflow-hidden rounded-full border border-outline"
>
  {#each segments as seg, i (seg.value)}
    {@const selected = seg.value === value}
    <button
      type="button"
      aria-pressed={selected}
      onclick={() => onchange(seg.value)}
      class="flex items-center gap-1.5 px-3 text-label-lg whitespace-nowrap {stateLayer} {focusRing}
        {i > 0 ? 'border-l border-outline' : ''}
        {selected
        ? 'bg-secondary-container text-on-secondary-container'
        : 'text-on-surface-variant'}"
    >
      {#if selected}<Check size={14} strokeWidth={2} class="shrink-0" />{/if}
      {seg.label}
    </button>
  {/each}
</div>
