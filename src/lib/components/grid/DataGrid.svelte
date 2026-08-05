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
  import { settings } from "$lib/stores/settings.svelte";
  import type { CellValue, ColumnInfo } from "$lib/api/types";

  // The one grid: read-only results (no `edit`) and the editable table-data view
  // (with `edit`) share cell rendering, virtualization, and formatting (DESIGN §10).
  // Editing is inline; identity/staging live in the table-data view + store.
  interface Props {
    columns: ColumnInfo[];
    rows: CellValue[][];
    edit?: EditController;
    label?: string;
  }
  let { columns, rows, edit, label = "Data grid" }: Props = $props();

  const ROW_H = 28;
  // Re-formats when rows change or the datetime-display setting flips (DESIGN §10).
  const display = $derived<CellDisplay[][]>(
    rows.map((r) => r.map((v) => formatCell(v, settings.datetimeDisplay))),
  );

  // Autofit: size each column to its header + a sample of cell text. Cells are mono,
  // so char-count → px is a reliable estimate with no DOM measuring/reflow. Clamped
  // so one long cell can't blow the layout out; anything past MAX still truncates.
  const CHAR_W = 7.3; // px per char at font-mono text-xs (~12px)
  const CELL_PAD = 22; // px-2 both sides + border + slack
  const MIN_COL = 64;
  const MAX_COL = 400;
  const SAMPLE = 200; // rows scanned per column; data is already row-limited
  const colWidths = $derived(
    columns.map((col, c) => {
      let chars = Math.max(col.name.length, col.typeName.length);
      const n = Math.min(display.length, SAMPLE);
      for (let r = 0; r < n; r++) {
        const cell = display[r]?.[c];
        const len = cell?.isNull ? 4 : (cell?.text?.length ?? 0);
        if (len > chars) chars = len;
      }
      return Math.min(MAX_COL, Math.max(MIN_COL, Math.round(chars * CHAR_W) + CELL_PAD));
    }),
  );
  const width = $derived(colWidths.reduce((sum, w) => sum + w, 0));

  let sel = $state<{ r: number; c: number } | null>(null);
  let editing = $state<{ r: number; c: number } | null>(null);
  let draft = $state("");
  let grid = $state<HTMLElement>();
  let viewport = $state<HTMLElement>();

  const isReadOnlyCell = (r: number, c: number): boolean => {
    const kind = rows[r]?.[c]?.kind;
    return kind === "bytes" || kind === "unknown" || edit?.rowState(r) === "deleted";
  };

  function focusSelect(node: HTMLInputElement): void {
    node.focus();
    node.select();
  }

  function select(r: number, c: number, focus = false): void {
    sel = { r, c };
    edit?.onSelect?.(r, c);
    if (focus) grid?.focus();
    if (!viewport) return;
    const headerHeight = 36;
    const rowTop = headerHeight + r * ROW_H;
    const rowBottom = rowTop + ROW_H;
    if (rowTop < viewport.scrollTop + headerHeight) viewport.scrollTop = Math.max(0, rowTop - headerHeight);
    else if (rowBottom > viewport.scrollTop + viewport.clientHeight) viewport.scrollTop = rowBottom - viewport.clientHeight;
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
    if (editing || !sel) return;
    const { r, c } = sel;
    if (e.key === "Enter" && edit) {
      e.preventDefault();
      startEdit(r, c);
    } else if (edit && (e.key === "Delete" || e.key === "Backspace")) {
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
    } else if (e.key === "Tab") {
      const last = rows.length * columns.length - 1;
      const next = r * columns.length + c + (e.shiftKey ? -1 : 1);
      if (next < 0 || next > last) return;
      e.preventDefault();
      select(Math.floor(next / columns.length), next % columns.length);
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
  bind:this={grid}
  role="grid"
  tabindex="0"
  aria-label={label}
  aria-rowcount={rows.length + 1}
  aria-colcount={columns.length}
  class="h-full outline-none"
  onkeydown={onGridKeydown}
  onfocus={(e) => {
    if (e.currentTarget === e.target && !sel && rows.length > 0 && columns.length > 0) select(0, 0);
  }}
>
  <VirtualList bind:viewport items={display} rowHeight={ROW_H} contentWidth={width} class="h-full">
    {#snippet header()}
      <div role="row" aria-rowindex="1" class="flex bg-grid-header-bg" style="width:{width}px">
        {#each columns as col, i (col.name)}
          <div
            role="columnheader"
            aria-colindex={i + 1}
            class="flex h-9 shrink-0 flex-col justify-center gap-0.5 border-r border-b border-border
              px-2 font-mono"
            style="width:{colWidths[i]}px"
            title={`${col.name} · ${col.typeName}${col.isPk ? " · PK" : ""}`}
          >
            <span class="truncate text-xs font-medium text-fg-1">{col.name}</span>
            <span class="truncate text-[10px] leading-none text-fg-2">{col.typeName}</span>
          </div>
        {/each}
      </div>
    {/snippet}
    {#snippet row(cells, r)}
      <div role="row" aria-rowindex={r + 2} class="flex {rowBg(r)} hover:bg-bg-2" style="width:{width}px">
        {#each cells as cell, c (c)}
          {@const selected = sel?.r === r && sel?.c === c}
          {@const dirty = edit?.isDirty(r, c)}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- Keyboard navigation/editing is handled on the role=grid container. -->
          <div
            role="gridcell"
            tabindex="-1"
            aria-colindex={c + 1}
            aria-selected={selected}
            class="relative flex h-7 shrink-0 items-center border-r border-b border-border px-2
              font-mono text-xs {cell.numeric ? 'justify-end tabular-nums' : ''}
              {dirty ? 'bg-grid-edited' : ''}
              {selected ? 'outline outline-1 -outline-offset-1 outline-accent' : ''}
              {edit?.rowState(r) === 'deleted' ? 'text-fg-2 line-through' : 'text-fg-1'}"
            style="width:{colWidths[c]}px"
            title={cell.title}
            onclick={() => select(r, c, true)}
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
