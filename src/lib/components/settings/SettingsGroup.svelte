<script lang="ts">
  import type { Snippet } from "svelte";

  // A titled run of settings rows: one border around the group, hairlines
  // between. Extracted because the general, shortcuts and about panes were each
  // writing the same `divide-y … rounded-sm border … ` container, which is three
  // chances for one of them to end up a different colour.
  //
  // The title is optional: a pane whose header bar already names it does not need
  // a second heading over its only group.
  interface Props {
    title?: string;
    children: Snippet;
  }
  let { title, children }: Props = $props();
</script>

<section class="flex flex-col gap-2">
  {#if title}
    <h3 class="text-label-sm tracking-wider text-on-surface-muted uppercase">{title}</h3>
  {/if}
  <div
    class="flex flex-col divide-y divide-outline-variant overflow-hidden rounded-sm border
      border-outline-variant bg-surface"
  >
    {@render children()}
  </div>
</section>
