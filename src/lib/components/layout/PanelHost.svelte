<script lang="ts">
  import SchemaTree from "$lib/components/schema/SchemaTree.svelte";
  import SavedQueriesPanel from "$lib/components/savedQueries/SavedQueriesPanel.svelte";
  import HistoryPanel from "$lib/components/history/HistoryPanel.svelte";
  import GitSyncPanel from "$lib/components/gitsync/GitSyncPanel.svelte";
  import ResizeHandle from "$lib/components/ui/ResizeHandle.svelte";
  import { fadeThroughIn, fadeThroughOut } from "$lib/utils/motion";
  import { panel, PANEL_MAX_W, PANEL_MIN_W } from "$lib/stores/panel.svelte";
  import { zoom } from "$lib/stores/zoom.svelte";

  // Renders the rail's active destination and owns the panel's width. Only the
  // active panel is mounted: a hidden panel that keeps polling (git status, saved
  // queries) would be doing work nobody can see.
  let aside = $state<HTMLElement>();

  // Measured from the panel's own left edge rather than from a drag origin, so
  // there is no start-position state to keep in sync. The rect is viewport px;
  // dividing by zoom converts it to the zoomed #app coordinate space the panel's
  // width lives in.
  function toWidth(clientX: number): number {
    if (!aside) return panel.width;
    return (clientX - aside.getBoundingClientRect().left) / zoom.level;
  }
</script>

<aside
  bind:this={aside}
  class="relative flex h-full shrink-0 flex-col border-r border-outline-variant bg-surface-container"
  style="width:{panel.width}px"
>
  <!-- Keyed on the destination so swapping panels runs the fade-through (DESIGN
       §7). Both halves are absolutely positioned inside this box: for the ~90 ms
       the old and new panels coexist they must overlap, not stack and halve each
       other's height. -->
  <div class="relative min-h-0 flex-1">
    {#key panel.active}
      <div class="absolute inset-0 flex flex-col" in:fadeThroughIn|local out:fadeThroughOut|local>
        {#if panel.active === "schema"}
          <SchemaTree />
        {:else if panel.active === "queries"}
          <SavedQueriesPanel />
        {:else if panel.active === "history"}
          <HistoryPanel />
        {:else}
          <GitSyncPanel />
        {/if}
      </div>
    {/key}
  </div>

  <!-- Right-edge resize handle: 8px grab zone straddling the 1px border, so it
       needs no extra expander of its own. -->
  <ResizeHandle
    orientation="vertical"
    value={panel.width}
    min={PANEL_MIN_W}
    max={PANEL_MAX_W}
    step={16}
    label="Resize panel"
    toValue={toWidth}
    onchange={(w) => panel.setWidth(w)}
    class="absolute inset-y-0 -right-1 z-20 w-2 hover:bg-primary/40"
  />
</aside>
