<script lang="ts">
  import SplitPane from "$lib/components/ui/SplitPane.svelte";
  import ConnectionList from "$lib/components/connections/ConnectionList.svelte";
  import SchemaTree from "$lib/components/schema/SchemaTree.svelte";
</script>

<aside class="h-full w-[260px] shrink-0 border-r border-border bg-bg-1">
  <SplitPane direction="vertical" initial={0.45} min={100}>
    {#snippet a()}<ConnectionList />{/snippet}
    {#snippet b()}<SchemaTree />{/snippet}
  </SplitPane>
</aside>
