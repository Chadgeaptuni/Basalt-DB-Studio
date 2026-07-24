<script lang="ts">
  import VirtualList from "$lib/components/ui/VirtualList.svelte";
  import { formatCell, type CellDisplay } from "$lib/utils/cellDisplay";
  import type { CellValue, ColumnInfo } from "$lib/api/types";

  // Read-only results grid (M2). Editing (CellEditor, staging) arrives in M3.
  // Fixed column width + a single scroller keep the header aligned; rows window
  // through VirtualList. Cells are pre-formatted once per fetch (DESIGN §10).
  interface Props {
    columns: ColumnInfo[];
    rows: CellValue[][];
  }
  let { columns, rows }: Props = $props();

  const COL_W = 180;
  const ROW_H = 28;
  const width = $derived(columns.length * COL_W);
  const display = $derived<CellDisplay[][]>(rows.map((r) => r.map(formatCell)));
</script>

<VirtualList items={display} rowHeight={ROW_H} contentWidth={width} class="h-full">
  {#snippet header()}
    <div class="flex bg-grid-header-bg" style="width:{width}px">
      {#each columns as col (col.name)}
        <div
          class="flex h-7 shrink-0 items-center gap-1.5 border-r border-b border-border px-2
            font-mono text-xs font-medium text-fg-1"
          style="width:{COL_W}px"
          title={`${col.name} · ${col.typeName}`}
        >
          <span class="truncate">{col.name}</span>
          <span class="truncate text-fg-2">{col.typeName}</span>
        </div>
      {/each}
    </div>
  {/snippet}
  {#snippet row(cells, i)}
    <div class="flex {i % 2 ? 'bg-grid-row-alt' : ''} hover:bg-bg-2" style="width:{width}px">
      {#each cells as cell, c (c)}
        <div
          class="flex h-7 shrink-0 items-center border-r border-b border-border px-2 font-mono text-xs
            text-fg-1 {cell.numeric ? 'justify-end tabular-nums' : ''}"
          style="width:{COL_W}px"
          title={cell.title}
        >
          {#if cell.isNull}
            <span class="text-grid-null italic">NULL</span>
          {:else}
            <span class="truncate">{cell.text}</span>
          {/if}
        </div>
      {/each}
    </div>
  {/snippet}
</VirtualList>
