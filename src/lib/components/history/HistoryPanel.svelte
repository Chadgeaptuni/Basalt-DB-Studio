<script lang="ts">
  import HistoryIcon from "@lucide/svelte/icons/history";
  import CircleCheck from "@lucide/svelte/icons/circle-check";
  import CircleX from "@lucide/svelte/icons/circle-x";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import VirtualList from "$lib/components/ui/VirtualList.svelte";
  import EmptyState from "$lib/components/ui/EmptyState.svelte";
  import IconButton from "$lib/components/ui/IconButton.svelte";
  import { history } from "$lib/stores/history.svelte";
  import { editorTabs } from "$lib/stores/tabs.svelte";

  const items = $derived(history.list);
  const fmtTime = (ms: number): string => new Date(ms).toLocaleTimeString();
</script>

<div class="flex h-full flex-col">
  <div class="flex h-7 shrink-0 items-center gap-2 border-b border-border px-2 font-mono text-[11px] text-fg-2">
    <span class="tabular-nums">{items.length} in history</span>
    <div class="flex-1"></div>
    <IconButton icon={Trash2} title="Clear history" size="sm" disabled={items.length === 0} onclick={() => history.clear()} />
  </div>
  {#if items.length === 0}
    <EmptyState icon={HistoryIcon} message="No queries run this session yet." />
  {:else}
    <VirtualList items={items} rowHeight={24} class="flex-1">
      {#snippet row(e)}
        <button
          class="flex h-6 w-full items-center gap-2 px-2 text-left font-mono text-xs text-fg-1
            transition-colors duration-150 hover:bg-bg-2"
          title={e.sql}
          onclick={() => editorTabs.open(e.sql)}
        >
          {#if e.ok}
            <CircleCheck size={12} strokeWidth={2} class="shrink-0 text-ok" />
          {:else}
            <CircleX size={12} strokeWidth={2} class="shrink-0 text-danger" />
          {/if}
          <span class="w-20 shrink-0 tabular-nums text-fg-2">{fmtTime(e.ranAt)}</span>
          <span class="flex-1 truncate">{e.sql.replace(/\s+/g, " ").trim()}</span>
          <span class="shrink-0 tabular-nums text-fg-2">
            {e.durationMs} ms{e.rowCount !== null ? ` · ${e.rowCount} rows` : ""}
          </span>
        </button>
      {/snippet}
    </VirtualList>
  {/if}
</div>
