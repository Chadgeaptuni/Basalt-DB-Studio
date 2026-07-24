<script lang="ts" module>
  /** Editing hooks supplied by the table-data view; absent → read-only grid. */
  export interface EditController {
    rowState: (rowIndex: number) => "normal" | "inserted" | "deleted";
    isDirty: (rowIndex: number, colIndex: number) => boolean;
    commit: (rowIndex: number, colIndex: number, raw: string) => void;
    setNull: (rowIndex: number, colIndex: number) => void;
    toggleDelete: (rowIndex: number) => void;
    onSelect?: (rowIndex: number, colIndex: number) => void;
  }
</script>

<script lang="ts">
  import VirtualList from "$lib/components/ui/VirtualList.svelte";
  import { formatCell, type CellDisplay } from "$lib/utils/cellDisplay";
  import { copyCellsTsv } from "$lib/utils/copy";
  import type { CellValue, ColumnInfo } from "$lib/api/types";

  // The one grid: read-only results (no `edit`) and the editable table-data view
  // (with `edit`) share cell rendering, virtualization, and formatting (DESIGN §10).
  // Editing is inline; identity/staging live in the table-data view + store.
  interface Props {
    columns: ColumnInfo[];
    rows: CellValue[][];
    edit?: EditController;
  }
  let { columns, rows, edit }: Props = $props();

  const COL_W = 180;
  const ROW_H = 28;
  const width = $derived(columns.length * COL_W);
  const display = $derived<CellDisplay[][]>(rows.map((r) => r.map(formatCell)));

  let sel = $state<{ r: number; c: number } | null>(null);
  let editing = $state<{ r: number; c: number } | null>(null);
  let draft = $state("");

  const isReadOnlyCell = (r: number, c: number): boolean => {
    const kind = rows[r]?.[c]?.kind;
    return kind === "bytes" || kind === "unknown" || edit?.rowState(r) === "deleted";
  };

  function focusSelect(node: HTMLInputElement): void {
    node.focus();
    node.select();
  }

  function select(r: number, c: number): void {
    sel = { r, c };
    edit?.onSelect?.(r, c);
  }

  function startEdit(r: number, c: number): void {
    if (!edit || isReadOnlyCell(r, c)) return;
    select(r, c);
    draft = display[r]?.[c]?.isNull ? "" : (display[r]?.[c]?.text ?? "");
    editing = { r, c };
  }

  function commitEdit(): void {
    if (editing) edit?.commit(editing.r, editing.c, draft);
    editing = null;
  }

  function onGridKeydown(e: KeyboardEvent): void {
    if (!edit || editing || !sel) return;
    const { r, c } = sel;
    if (e.key === "Enter") {
      e.preventDefault();
      startEdit(r, c);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      if (!isReadOnlyCell(r, c)) edit.setNull(r, c);
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c") {
      e.preventDefault();
      const cell = rows[r]?.[c];
      if (cell) void copyCellsTsv([[cell]]);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      select(r, Math.min(columns.length - 1, c + 1));
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      select(r, Math.max(0, c - 1));
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      select(Math.min(rows.length - 1, r + 1), c);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      select(Math.max(0, r - 1), c);
    }
  }

  const rowBg = (r: number): string => {
    const state = edit?.rowState(r);
    if (state === "deleted") return "bg-danger-bg";
    if (state === "inserted") return "bg-grid-edited";
    return r % 2 ? "bg-grid-row-alt" : "";
  };
</script>

<div
  role="grid"
  tabindex={edit ? 0 : undefined}
  class="h-full outline-none"
  onkeydown={onGridKeydown}
>
  <VirtualList items={display} rowHeight={ROW_H} contentWidth={width} class="h-full">
    {#snippet header()}
      <div class="flex bg-grid-header-bg" style="width:{width}px">
        {#each columns as col (col.name)}
          <div
            class="flex h-7 shrink-0 items-center gap-1.5 border-r border-b border-border px-2
              font-mono text-xs font-medium text-fg-1"
            style="width:{COL_W}px"
            title={`${col.name} · ${col.typeName}${col.isPk ? " · PK" : ""}`}
          >
            <span class="truncate">{col.name}</span>
            <span class="truncate text-fg-2">{col.typeName}</span>
          </div>
        {/each}
      </div>
    {/snippet}
    {#snippet row(cells, r)}
      <div class="flex {rowBg(r)} hover:bg-bg-2" style="width:{width}px">
        {#each cells as cell, c (c)}
          {@const selected = edit && sel?.r === r && sel?.c === c}
          {@const dirty = edit?.isDirty(r, c)}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- Keyboard navigation/editing is handled on the role=grid container. -->
          <div
            role="gridcell"
            tabindex="-1"
            class="relative flex h-7 shrink-0 items-center border-r border-b border-border px-2
              font-mono text-xs {cell.numeric ? 'justify-end tabular-nums' : ''}
              {dirty ? 'bg-grid-edited' : ''}
              {selected ? 'outline outline-1 -outline-offset-1 outline-accent' : ''}
              {edit?.rowState(r) === 'deleted' ? 'text-fg-2 line-through' : 'text-fg-1'}"
            style="width:{COL_W}px"
            title={cell.title}
            onclick={() => edit && select(r, c)}
            ondblclick={() => startEdit(r, c)}
          >
            {#if editing && editing.r === r && editing.c === c}
              <input
                use:focusSelect
                bind:value={draft}
                class="absolute inset-0 h-full w-full border border-accent bg-bg-2 px-2 font-mono
                  text-xs text-fg-0 outline-none"
                onkeydown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitEdit();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    editing = null;
                  }
                  e.stopPropagation();
                }}
                onblur={commitEdit}
              />
            {:else if cell.isNull}
              <span class="text-grid-null italic">NULL</span>
            {:else}
              <span class="truncate">{cell.text}</span>
            {/if}
          </div>
        {/each}
      </div>
    {/snippet}
  </VirtualList>
</div>
