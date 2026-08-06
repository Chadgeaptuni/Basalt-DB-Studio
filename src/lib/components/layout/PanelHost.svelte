<script lang="ts">
  import SchemaTree from "$lib/components/schema/SchemaTree.svelte";
  import SavedQueriesPanel from "$lib/components/savedQueries/SavedQueriesPanel.svelte";
  import HistoryPanel from "$lib/components/history/HistoryPanel.svelte";
  import GitSyncPanel from "$lib/components/gitsync/GitSyncPanel.svelte";
  import { panel } from "$lib/stores/panel.svelte";
  import { zoom } from "$lib/stores/zoom.svelte";

  // Renders the rail's active destination and owns the panel's width. Only the
  // active panel is mounted: a hidden panel that keeps polling (git status, saved
  // queries) would be doing work nobody can see.
  let resizing = false;
  let startX = 0;
  let startW = 0;

  function startResize(e: PointerEvent): void {
    e.preventDefault();
    resizing = true;
    startX = e.clientX;
    startW = panel.width;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  // Pointer delta is viewport px; divide by zoom because the panel's px live
  // inside the zoomed #app coordinate space.
  function onResize(e: PointerEvent): void {
    if (resizing) panel.setWidth(startW + (e.clientX - startX) / zoom.level);
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
  style="width:{panel.width}px"
>
  {#if panel.active === "schema"}
    <SchemaTree />
  {:else if panel.active === "queries"}
    <SavedQueriesPanel />
  {:else if panel.active === "history"}
    <HistoryPanel />
  {:else}
    <GitSyncPanel />
  {/if}

  <!-- Right-edge resize handle: 8px grab zone straddling the 1px border. -->
  <div
    role="separator"
    aria-orientation="vertical"
    aria-label="Resize panel"
    onpointerdown={startResize}
    onpointermove={onResize}
    onpointerup={endResize}
    onpointercancel={endResize}
    class="absolute inset-y-0 -right-1 z-20 w-2 cursor-col-resize hover:bg-primary/40"
  ></div>
</aside>
