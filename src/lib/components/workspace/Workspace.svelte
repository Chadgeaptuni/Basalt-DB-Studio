<script lang="ts">
  import Plus from "@lucide/svelte/icons/plus";
  import SplitPane from "$lib/components/ui/SplitPane.svelte";
  import IconButton from "$lib/components/ui/IconButton.svelte";
  import Tabs, { type TabItem } from "$lib/components/ui/Tabs.svelte";
  import EditorPane from "$lib/components/editor/EditorPane.svelte";
  import ResultsPane from "$lib/components/grid/ResultsPane.svelte";
  import TableDataView from "$lib/components/grid/TableDataView.svelte";
  import { editorTabs } from "$lib/stores/tabs.svelte";
  import { keyboard } from "$lib/utils/keyboard";

  // Shared tab bar over both tab kinds; SQL tabs get the editor/results split,
  // table tabs get the editable data view (DESIGN §5).
  let showHistory = $state(false);

  $effect(() => {
    if (editorTabs.list.length === 0) editorTabs.open();
  });

  const active = $derived(editorTabs.active);
  const tabItems = $derived<TabItem[]>(
    editorTabs.list.map((t) => ({ id: t.id, label: t.title, closable: editorTabs.list.length > 1 })),
  );

  $effect(() => keyboard.register("mod+t", () => editorTabs.open()));
  $effect(() =>
    keyboard.register("mod+w", () => {
      if (editorTabs.active && editorTabs.list.length > 1) editorTabs.close(editorTabs.active.id);
    }),
  );
</script>

<div class="flex h-full flex-col">
  <Tabs items={tabItems} activeId={active?.id ?? null} onSelect={editorTabs.select} onClose={editorTabs.close}>
    {#snippet trailing()}
      <IconButton icon={Plus} title={`New tab · ${keyboard.label("mod+t")}`} size="sm" onclick={() => editorTabs.open()} />
    {/snippet}
  </Tabs>

  <div class="min-h-0 flex-1">
    {#if active?.kind === "table"}
      <TableDataView tab={active} />
    {:else}
      <SplitPane direction="vertical" initial={0.5} min={120}>
        {#snippet a()}<EditorPane />{/snippet}
        {#snippet b()}<ResultsPane {showHistory} onToggleHistory={() => (showHistory = !showHistory)} />{/snippet}
      </SplitPane>
    {/if}
  </div>
</div>
