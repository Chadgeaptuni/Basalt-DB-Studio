<script lang="ts" generics="T">
  import type { Snippet } from "svelte";

  // Hand-rolled windowing (DESIGN §10 / spec Performance plan): fixed row height,
  // only visible rows + overscan are in the DOM. Data is already row-limited, so
  // this windows the DOM, not the data.
  interface Props {
    items: T[];
    rowHeight: number;
    overscan?: number;
    row: Snippet<[T, number]>;
    /** Sticky header rendered inside the same scroller so it aligns and co-scrolls
     *  horizontally with the rows (used by the data grid). */
    header?: Snippet;
    /** Fixed inner content width (px) — enables horizontal scroll for wide grids. */
    contentWidth?: number;
    /** Optional viewport binding for consumers that move a virtual selection. */
    viewport?: HTMLElement;
    class?: string;
  }

  let {
    items,
    rowHeight,
    overscan = 10,
    row,
    header,
    contentWidth,
    viewport = $bindable(),
    class: cls = "",
  }: Props = $props();

  const widthStyle = $derived(contentWidth ? `width:${contentWidth}px;` : "");

  let scrollTop = $state(0);
  let clientHeight = $state(0);

  const total = $derived(items.length * rowHeight);
  const start = $derived(Math.max(0, Math.floor(scrollTop / rowHeight) - overscan));
  const visibleCount = $derived(Math.ceil(clientHeight / rowHeight) + overscan * 2);
  const end = $derived(Math.min(items.length, start + visibleCount));
  const offsetY = $derived(start * rowHeight);
  const slice = $derived(items.slice(start, end));

  function onscroll(): void {
    if (viewport) scrollTop = viewport.scrollTop;
  }

  $effect(() => {
    if (!viewport) return;
    clientHeight = viewport.clientHeight;
    const ro = new ResizeObserver(() => {
      if (viewport) clientHeight = viewport.clientHeight;
    });
    ro.observe(viewport);
    return () => ro.disconnect();
  });
</script>

<div bind:this={viewport} {onscroll} class="relative overflow-auto {cls}">
  {#if header}
    <div class="sticky top-0 z-10" style={widthStyle}>{@render header()}</div>
  {/if}
  <div style="height:{total}px;{widthStyle}" class="relative">
    <div style="transform:translateY({offsetY}px)" class="absolute inset-x-0 top-0">
      {#each slice as item, i (start + i)}
        {@render row(item, start + i)}
      {/each}
    </div>
  </div>
</div>
