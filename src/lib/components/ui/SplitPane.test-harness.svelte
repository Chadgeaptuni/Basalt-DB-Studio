<script lang="ts">
  import SplitPane from "./SplitPane.svelte";
</script>

<div class="h-96">
  <SplitPane direction="vertical" initial={0.5} min={120} label="Resize editor and results">
    {#snippet a()}<div>Editor</div>{/snippet}
    {#snippet b()}<div>Results</div>{/snippet}
  </SplitPane>
</div>
