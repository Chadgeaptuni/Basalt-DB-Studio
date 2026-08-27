<script lang="ts">
  import SchemaTree from "$lib/components/schema/SchemaTree.svelte";
  import SavedQueriesPanel from "$lib/components/savedQueries/SavedQueriesPanel.svelte";
  import HistoryPanel from "$lib/components/history/HistoryPanel.svelte";
  import GitSyncPanel from "$lib/components/gitsync/GitSyncPanel.svelte";
  import ResizeHandle from "$lib/components/ui/ResizeHandle.svelte";
  import { panelIn, panelOut } from "$lib/utils/motion";
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

<!-- Three boxes, and each one is load-bearing while the panel opens or closes:
     the outer animates its width (the main area has to give up the space, so
     there is no avoiding a layout animation here), the middle clips, and the
     inner is pinned to the panel's resting width so its subtree is laid out once
     instead of reflowing on every frame. A schema tree of several hundred rows
     is what that pin is for. The resize handle stays outside the clip — it
     straddles the border and would lose its outer half to `overflow-hidden`. -->
<aside
  bind:this={aside}
  class="relative h-full shrink-0"
  style="width:{panel.width}px"
  in:panelIn
  out:panelOut
>
  <!-- No `border-r`: the resize handle below *is* this edge's hairline, the way
       `SplitPane`'s is. Keeping both drew two lines a pixel apart, and only the
       border recoloured on hover. -->
  <div
    class="h-full overflow-hidden bg-surface-container"
  >
    <!-- Swapping destinations is an instant cut, not a cross-fade. The fade ran
         300 ms with both panels mounted and absolutely positioned over each
         other, so the incoming panel did its first layout — a schema tree of
         several hundred rows — inside the animation, and the frames it dropped
         were the whole effect. Each panel already reports its own loading state,
         which is the honest signal anyway: a fade says "arriving", a spinner
         says "still fetching". -->
    <div class="flex h-full min-h-0 flex-col" style="width:{panel.width}px">
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
  </div>

  <!-- Right-edge resize handle, and the panel's right hairline: a 1px line with
       `grab`'s ±4px expander, identical in construction to `SplitPane`'s. -->
  <ResizeHandle
    orientation="vertical"
    value={panel.width}
    min={PANEL_MIN_W}
    max={PANEL_MAX_W}
    step={16}
    label="Resize panel"
    toValue={toWidth}
    onchange={(w) => panel.setWidth(w)}
    grab
    class="absolute inset-y-0 right-0 z-20 w-px"
  />
</aside>
