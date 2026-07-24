<script lang="ts">
  import SplitPane from "$lib/components/ui/SplitPane.svelte";
  import ConnectionList from "$lib/components/connections/ConnectionList.svelte";
  import SchemaTree from "$lib/components/schema/SchemaTree.svelte";
  import SavedQueriesPanel from "$lib/components/savedQueries/SavedQueriesPanel.svelte";
  import GitSyncBar from "$lib/components/gitsync/GitSyncBar.svelte";
</script>

<aside class="flex h-full w-[260px] shrink-0 flex-col border-r border-border bg-bg-1">
  <div class="min-h-0 flex-1">
    <SplitPane direction="vertical" initial={0.4} min={90}>
      {#snippet a()}<ConnectionList />{/snippet}
      {#snippet b()}
        <SplitPane direction="vertical" initial={0.6} min={90}>
          {#snippet a()}<SchemaTree />{/snippet}
          {#snippet b()}<SavedQueriesPanel />{/snippet}
        </SplitPane>
      {/snippet}
    </SplitPane>
  </div>
  <GitSyncBar />
</aside>
