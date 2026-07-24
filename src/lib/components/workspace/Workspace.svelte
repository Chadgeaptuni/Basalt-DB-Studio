<script lang="ts">
  import SplitPane from "$lib/components/ui/SplitPane.svelte";
  import EditorPane from "$lib/components/editor/EditorPane.svelte";
  import ResultsPane from "$lib/components/grid/ResultsPane.svelte";
  import { editorTabs } from "$lib/stores/tabs.svelte";

  // Editor above, results below (DESIGN §5). History overlays the results pane.
  let showHistory = $state(false);

  // Guarantee an editor tab exists as soon as the workspace mounts.
  $effect(() => {
    if (editorTabs.list.length === 0) editorTabs.open();
  });
</script>

<SplitPane direction="vertical" initial={0.5} min={120}>
  {#snippet a()}<EditorPane />{/snippet}
  {#snippet b()}<ResultsPane {showHistory} onToggleHistory={() => (showHistory = !showHistory)} />{/snippet}
</SplitPane>
