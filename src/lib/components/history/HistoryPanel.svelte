<script lang="ts">
  import HistoryIcon from "@lucide/svelte/icons/history";
  import CircleCheck from "@lucide/svelte/icons/circle-check";
  import CircleX from "@lucide/svelte/icons/circle-x";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import VirtualList from "$lib/components/ui/VirtualList.svelte";
  import EmptyState from "$lib/components/ui/EmptyState.svelte";
  import IconButton from "$lib/components/ui/IconButton.svelte";
  import Panel from "$lib/components/layout/Panel.svelte";
  import { stateLayerPill, focusRing } from "$lib/components/ui/stateLayer";
  import { history } from "$lib/stores/history.svelte";
  import { editorTabs } from "$lib/stores/tabs.svelte";

  const items = $derived(history.list);
  const fmtTime = (ms: number): string => new Date(ms).toLocaleTimeString();
</script>

<Panel title="History">
  {#snippet actions()}
    <span class="pr-1 text-data text-on-surface-muted tabular-nums">{items.length}</span>
    <IconButton
      icon={Trash2}
      title="Clear history"
      size="sm"
      disabled={items.length === 0}
      onclick={() => history.clear()}
    />
  {/snippet}

  {#if items.length === 0}
    <EmptyState icon={HistoryIcon} message="No queries run this session yet." />
  {:else}
    <VirtualList items={items} rowHeight={36} class="flex-1">
      {#snippet row(e)}
        <button
          class="flex h-9 w-full items-center gap-2 px-3 text-left text-data text-on-surface-variant
            {stateLayerPill} {focusRing}"
          title={e.sql}
          onclick={() => editorTabs.open(e.sql)}
        >
          {#if e.ok}
            <CircleCheck size={12} strokeWidth={2} class="shrink-0 text-ok" />
          {:else}
            <CircleX size={12} strokeWidth={2} class="shrink-0 text-error" />
          {/if}
          <span class="w-20 shrink-0 tabular-nums text-on-surface-muted">{fmtTime(e.ranAt)}</span>
          <span class="flex-1 truncate">{e.sql.replace(/\s+/g, " ").trim()}</span>
          <span class="shrink-0 tabular-nums text-on-surface-muted">
            {e.durationMs} ms{e.rowCount !== null ? ` · ${e.rowCount} rows` : ""}
          </span>
        </button>
      {/snippet}
    </VirtualList>
  {/if}
</Panel>
