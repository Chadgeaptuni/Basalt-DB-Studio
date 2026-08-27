<script lang="ts">
  import type { Snippet } from "svelte";
  import type { IconComponent } from "./icon";
  import { stateLayerPill, stateLayerFlush, focusRing } from "./stateLayer";

  // The M3 list row (DESIGN §6): 36px, leading icon, headline, optional supporting
  // text, trailing slot. Every list of objects renders through this — a hand-rolled
  // `<div class="flex h-9 …">` row is a review failure.
  //
  // Single-line only, on purpose. M3's two-line item is 72dp (56 even at density
  // −2), which is a third of a short list; supporting text reads inline and muted
  // instead, which is also how a DB tool wants it (`users  1.2k`, `prod  db:5432`).
  //
  // `trailing` sits outside the button so a row can carry its own controls without
  // nesting interactive elements.
  interface Props {
    headline: string;
    supporting?: string;
    icon?: IconComponent;
    selected?: boolean;
    title?: string;
    /** Renders the headline in mono — for rows whose subject is data (a table, a host). */
    mono?: boolean;
    /** For a row inside a divided or bordered list: hover fills the row instead of
     *  drawing the inset pill, which would leave a gap against the divider. */
    flush?: boolean;
    onclick?: () => void;
    ondblclick?: () => void;
    leading?: Snippet;
    trailing?: Snippet;
  }

  let {
    headline,
    supporting,
    icon: Icon,
    selected = false,
    title,
    mono = false,
    flush = false,
    onclick,
    ondblclick,
    leading,
    trailing,
  }: Props = $props();
</script>

<!-- A flush row's selected fill sits on this container, not on the button: the
     flush layer is a real background, so a tonal fill on the same element would
     be replaced by the 8% wash on hover instead of washed over. -->
<div
  class="flex h-9 items-center {selected ? 'text-on-secondary-container' : 'text-on-surface-variant'}
    {flush && selected ? 'bg-secondary-container' : ''}"
>
  <button
    type="button"
    {title}
    aria-current={selected ? true : undefined}
    {onclick}
    {ondblclick}
    class="flex h-full min-w-0 flex-1 items-center gap-2 px-3 text-left {focusRing}
      {flush ? stateLayerFlush : stateLayerPill}"
  >
    <!-- Selected is a tonal pill *behind* the state layer (-z-20 vs -z-10), not a
         brighter layer: folding it into `before` would make hovering a selected
         row dim it back down to the 8% hover value. -->
    {#if selected && !flush}
      <span
        aria-hidden="true"
        class="pointer-events-none absolute inset-x-1 inset-y-0.5 -z-20 rounded-full bg-secondary-container"
      ></span>
    {/if}

    {#if leading}
      <span class="flex shrink-0 items-center">{@render leading()}</span>
    {:else if Icon}
      <Icon size={16} strokeWidth={2} class="shrink-0 text-on-surface-muted" />
    {/if}

    <span class="min-w-0 flex-1 truncate {mono ? 'text-data' : 'text-label-md'}
      {selected ? 'text-on-surface' : ''}">
      {headline}
    </span>

    {#if supporting}
      <span class="shrink-0 truncate text-label-sm text-on-surface-muted">{supporting}</span>
    {/if}
  </button>

  {#if trailing}
    <div class="flex shrink-0 items-center gap-1 pr-2">{@render trailing()}</div>
  {/if}
</div>
