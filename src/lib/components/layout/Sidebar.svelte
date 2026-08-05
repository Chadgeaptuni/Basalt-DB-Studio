<script lang="ts">
  import SchemaTree from "$lib/components/schema/SchemaTree.svelte";
  import SavedQueriesPanel from "$lib/components/savedQueries/SavedQueriesPanel.svelte";
  import GitSyncBar from "$lib/components/gitsync/GitSyncBar.svelte";
  import { sidebar, SECTIONS, HEADER_H, MIN_BODY } from "$lib/stores/sidebar.svelte";
  import { zoom } from "$lib/stores/zoom.svelte";

  let stack = $state<HTMLElement>();

  const measure = (): void => {
    if (stack) sidebar.setAvailH(stack.clientHeight);
  };

  $effect(() => {
    if (!stack) return;
    const ro = new ResizeObserver(measure);
    ro.observe(stack);
    measure();
    return () => ro.disconnect();
  });
  // CSS `zoom` rescales the sidebar's local px height without firing the RO reliably,
  // so re-measure whenever zoom changes. ponytail: RO covers window resize.
  $effect(() => {
    zoom.level;
    measure();
  });

  // Auto-collapse the lowest-priority open sections when there isn't room to show
  // each open body at MIN_BODY. Priority is top→bottom (Schema kept longest).
  $effect(() => {
    const openIds = SECTIONS.filter((s) => !sidebar.isCollapsed(s.id)).map((s) => s.id);
    const fits = Math.max(0, Math.floor((sidebar.availH - SECTIONS.length * HEADER_H) / MIN_BODY));
    sidebar.setAutoHidden([...openIds.slice(fits)]);
  });

  // Right-edge resize. Pointer delta is viewport px; divide by zoom because the
  // sidebar's px live inside the zoomed #app coordinate space.
  let resizing = false;
  let startX = 0;
  let startW = 0;
  function startResize(e: PointerEvent): void {
    e.preventDefault();
    resizing = true;
    startX = e.clientX;
    startW = sidebar.width;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onResize(e: PointerEvent): void {
    if (resizing) sidebar.setWidth(startW + (e.clientX - startX) / zoom.level);
  }
  function endResize(e: PointerEvent): void {
    resizing = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* pointer already released */
    }
  }
</script>

<aside
  class="relative flex h-full shrink-0 flex-col border-r border-outline-variant bg-surface-container"
  style="width:{sidebar.width}px"
>
  <div bind:this={stack} class="flex min-h-0 flex-1 flex-col">
    <SchemaTree />
    <SavedQueriesPanel />
  </div>
  <GitSyncBar />

  <!-- Right-edge resize handle: 2px grab zone straddling the border. -->
  <div
    role="separator"
    aria-orientation="vertical"
    aria-label="Resize sidebar"
    onpointerdown={startResize}
    onpointermove={onResize}
    onpointerup={endResize}
    class="absolute inset-y-0 -right-1 z-20 w-2 cursor-col-resize hover:bg-accent/40"
  ></div>
</aside>
