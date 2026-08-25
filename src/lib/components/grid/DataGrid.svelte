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
  import ArrowUp from "@lucide/svelte/icons/arrow-up";
  import ArrowDown from "@lucide/svelte/icons/arrow-down";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import EyeOff from "@lucide/svelte/icons/eye-off";
  import Copy from "@lucide/svelte/icons/copy";
  import VirtualList from "$lib/components/ui/VirtualList.svelte";
  import DropdownMenu from "$lib/components/ui/DropdownMenu.svelte";
  import Chip from "$lib/components/ui/Chip.svelte";
  import type { MenuItem } from "$lib/components/ui/menu";
  import { stateLayer, stateLayerGrid } from "$lib/components/ui/stateLayer";
  import { formatCell, type CellDisplay } from "$lib/utils/cellDisplay";
  import { copyCellsTsv } from "$lib/utils/copy";
  import { settings } from "$lib/stores/settings.svelte";
  import { sortedOrder, type SortState } from "./gridView";
  import CellInspector from "./CellInspector.svelte";
  import type { CellValue, ColumnInfo } from "$lib/api/types";

  // The one grid: read-only results (no `edit`) and the editable table-data view
  // (with `edit`) share cell rendering, virtualization, and formatting (DESIGN §10).
  // Editing is inline; identity/staging live in the table-data view + store.
  interface Props {
    columns: ColumnInfo[];
    rows: CellValue[][];
    edit?: EditController;
    label?: string;
    /** True when the backend row-limited this result — changes what a sort means. */
    truncated?: boolean;
  }
  let { columns, rows, edit, label = "Data grid", truncated = false }: Props = $props();

  const ROW_H = 28;

  // View state: reordering and hiding are presentation only. No SQL is generated
  // and nothing is re-fetched — see gridView.ts for why that is stated out loud.
  let sort = $state<SortState | null>(null);
  let hidden = $state<Set<number>>(new Set());
  let inspecting = $state(false);

  const visibleCols = $derived(columns.map((c, i) => ({ col: c, i })).filter(({ i }) => !hidden.has(i)));
  // Row *indices*, not rows: edit staging identifies rows by their original index.
  const order = $derived(sortedOrder(rows, sort));

  function toggleSort(index: number, dir: SortState["dir"]): void {
    sort = sort?.column === index && sort.dir === dir ? null : { column: index, dir };
  }

  function hideColumn(index: number): void {
    const next = new Set(hidden);
    next.add(index);
    hidden = next;
    // A hidden column can't stay the sort key — the state would be invisible.
    if (sort?.column === index) sort = null;
  }

  function showAll(): void {
    hidden = new Set();
  }

  function columnMenu(index: number): MenuItem[] {
    const col = columns[index];
    return [
      {
        label: "Sort ascending",
        icon: ArrowUp,
        checked: sort?.column === index && sort.dir === "asc",
        onselect: () => toggleSort(index, "asc"),
      },
      {
        label: "Sort descending",
        icon: ArrowDown,
        checked: sort?.column === index && sort.dir === "desc",
        onselect: () => toggleSort(index, "desc"),
      },
      { label: "Copy column name", icon: Copy, onselect: () => void copyCellsTsv([[{ kind: "text", value: col.name }]]) },
      {
        label: "Copy column values",
        icon: Copy,
        onselect: () => void copyCellsTsv(order.map((r) => [rows[r][index]])),
      },
      {
        label: "Hide column",
        icon: EyeOff,
        disabled: visibleCols.length <= 1,
        onselect: () => hideColumn(index),
      },
    ];
  }
  // Re-formats when rows change or the datetime-display setting flips (DESIGN §10).
  const display = $derived<CellDisplay[][]>(
    rows.map((r) => r.map((v) => formatCell(v, settings.datetimeDisplay))),
  );

  // Autofit: size each column to its header + a sample of cell text. Cells are mono,
  // so char-count → px is a reliable estimate with no DOM measuring/reflow. Clamped
  // so one long cell can't blow the layout out; anything past MAX still truncates.
  const CHAR_W = 7.3; // px per char at text-data (~12px)
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
  const width = $derived(visibleCols.reduce((sum, { i }) => sum + colWidths[i], 0));

  // Selection lives in *display* coordinates — the row as shown after sorting, the
  // column as shown after hiding — because that is what the arrow keys move
  // through. Everything handed to `edit` is mapped back to the original indices,
  // which is how staged edits identify their row.
  const rowAt = (dr: number): number => order[dr] ?? dr;
  const colAt = (vc: number): number => visibleCols[vc]?.i ?? vc;

  let sel = $state<{ r: number; c: number } | null>(null);
  let editing = $state<{ r: number; c: number } | null>(null);
  let draft = $state("");
  // The draft as the session opened. The draft is seeded from the *display*
  // string, which for JSON/array/NULL/converted datetimes is not the stored form —
  // re-parsing it unchanged would stage a phantom edit.
  let draftAtOpen = "";
  let grid = $state<HTMLElement>();
  let viewport = $state<HTMLElement>();

  const isReadOnlyCell = (dr: number, vc: number): boolean => {
    const r = rowAt(dr);
    const kind = rows[r]?.[colAt(vc)]?.kind;
    return kind === "bytes" || kind === "unknown" || edit?.rowState(r) === "deleted";
  };

  const selectedValue = $derived(sel ? rows[rowAt(sel.r)]?.[colAt(sel.c)] : undefined);
  const selectedColumn = $derived(sel ? columns[colAt(sel.c)] : undefined);

  function focusSelect(node: HTMLInputElement): void {
    node.focus();
    node.select();
  }

  function select(r: number, c: number, focus = false): void {
    sel = { r, c };
    edit?.onSelect?.(rowAt(r), colAt(c));
    if (focus) grid?.focus();
    if (!viewport) return;
    // Must track the sticky header's own height below, or scroll-into-view parks
    // the top row underneath it.
    const headerHeight = 40;
    const rowTop = headerHeight + r * ROW_H;
    const rowBottom = rowTop + ROW_H;
    if (rowTop < viewport.scrollTop + headerHeight) viewport.scrollTop = Math.max(0, rowTop - headerHeight);
    else if (rowBottom > viewport.scrollTop + viewport.clientHeight) viewport.scrollTop = rowBottom - viewport.clientHeight;
  }

  function startEdit(r: number, c: number): void {
    if (!edit || isReadOnlyCell(r, c)) return;
    select(r, c);
    const cell = display[rowAt(r)]?.[colAt(c)];
    draft = cell?.isNull ? "" : (cell?.text ?? "");
    draftAtOpen = draft;
    editing = { r, c };
  }

  function commitEdit(): void {
    if (editing && draft !== draftAtOpen) {
      edit?.commit(rowAt(editing.r), colAt(editing.c), draft);
    }
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
      if (!isReadOnlyCell(r, c)) edit.setNull(rowAt(r), colAt(c));
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c") {
      e.preventDefault();
      const cell = rows[rowAt(r)]?.[colAt(c)];
      if (cell) void copyCellsTsv([[cell]]);
    } else if (e.key === " ") {
      e.preventDefault();
      inspecting = !inspecting;
    } else if (e.key === "Escape" && inspecting) {
      // Escape closes the open overlay (DESIGN §7). The cell editor's own input
      // stops propagation, so reverting an edit still wins while editing.
      e.preventDefault();
      inspecting = false;
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      select(r, Math.min(visibleCols.length - 1, c + 1));
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      select(r, Math.max(0, c - 1));
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      select(Math.min(order.length - 1, r + 1), c);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      select(Math.max(0, r - 1), c);
    } else if (e.key === "Tab") {
      const cols = visibleCols.length;
      const last = order.length * cols - 1;
      const next = r * cols + c + (e.shiftKey ? -1 : 1);
      if (next < 0 || next > last) return;
      e.preventDefault();
      select(Math.floor(next / cols), next % cols);
    }
  }

  // Zebra follows the *displayed* position so stripes stay alternating after a
  // sort; row state follows the original row, which is what was edited.
  const rowBg = (r: number, displayIndex: number): string => {
    const state = edit?.rowState(r);
    if (state === "deleted") return "bg-error-container";
    if (state === "inserted") return "bg-grid-edited";
    return displayIndex % 2 ? "bg-grid-row-alt" : "";
  };
</script>

<!-- `relative` anchors the inspector sheet to the grid, so it overlays the rows
     instead of shrinking them (DESIGN §6). -->
<div class="relative flex h-full flex-col">
  {#if sort || hidden.size > 0}
    <!-- View state as removable chips: an active sort or hidden column has to be
         visible and reversible, not buried in the menu that set it. -->
    <div
      class="flex h-10 shrink-0 items-center gap-2 overflow-x-auto border-b border-outline-variant
        bg-surface-container px-2"
    >
      {#if sort}
        <Chip
          icon={sort.dir === "asc" ? ArrowUp : ArrowDown}
          tone={truncated ? "warn" : "neutral"}
          onremove={() => (sort = null)}
          removeLabel="Clear sort"
          title={truncated
            ? "Only the rows loaded so far are sorted — the result was row-limited"
            : undefined}
        >
          {columns[sort.column]?.name}{truncated ? " · loaded rows only" : ""}
        </Chip>
      {/if}
      {#if hidden.size > 0}
        <Chip icon={EyeOff} onremove={showAll} removeLabel="Show all columns">
          {hidden.size} hidden
        </Chip>
      {/if}
    </div>
  {/if}

<div
  bind:this={grid}
  role="grid"
  tabindex="0"
  aria-label={label}
  aria-rowcount={rows.length + 1}
  aria-colcount={visibleCols.length}
  class="min-h-0 flex-1 outline-none"
  onkeydown={onGridKeydown}
  onfocus={(e) => {
    if (e.currentTarget === e.target && !sel && rows.length > 0 && visibleCols.length > 0) select(0, 0);
  }}
>
  <VirtualList bind:viewport items={order} rowHeight={ROW_H} contentWidth={width} class="h-full">
    {#snippet header()}
      <div role="row" aria-rowindex="1" class="flex bg-grid-header-bg" style="width:{width}px">
        {#each visibleCols as { col, i } (col.name)}
          {@const sorted = sort?.column === i ? sort.dir : null}
          <div
            role="columnheader"
            aria-colindex={i + 1}
            aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"}
            class="group relative flex h-10 shrink-0 items-center border-r border-b
              border-outline-variant pr-1 pl-2"
            style="width:{colWidths[i]}px"
            title={`${col.name} · ${col.typeName}${col.isPk ? " · PK" : ""}`}
          >
            <span class="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
              <!-- The column name is data (it is an identifier); the type under it
                   is an annotation, so it takes the label role rather than mono. -->
              <span class="flex min-w-0 items-center gap-1">
                <span class="truncate text-data text-on-surface-variant">{col.name}</span>
                {#if sorted}
                  {#if sorted === "asc"}
                    <ArrowUp size={12} strokeWidth={2} class="shrink-0 text-primary" />
                  {:else}
                    <ArrowDown size={12} strokeWidth={2} class="shrink-0 text-primary" />
                  {/if}
                {/if}
              </span>
              <span class="truncate text-label-sm leading-none text-on-surface-muted">{col.typeName}</span>
            </span>
            <DropdownMenu
              items={columnMenu(i)}
              label={`${col.name} column menu`}
              align="end"
              triggerClass="grid h-6 w-6 shrink-0 place-items-center rounded-full text-on-surface-muted
                opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100
                data-[state=open]:opacity-100 {stateLayer}"
            >
              <ChevronDown size={14} strokeWidth={2} />
            </DropdownMenu>
          </div>
        {/each}
      </div>
    {/snippet}
    {#snippet row(r, dr)}
      <div
        role="row"
        aria-rowindex={dr + 2}
        class="flex {rowBg(r, dr)} {stateLayerGrid}"
        style="width:{width}px"
      >
        {#each visibleCols as { i: ci }, c (ci)}
          {@const cell = display[r][ci]}
          {@const selected = sel?.r === dr && sel?.c === c}
          {@const dirty = edit?.isDirty(r, ci)}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- Keyboard navigation/editing is handled on the role=grid container. -->
          <div
            role="gridcell"
            tabindex="-1"
            aria-colindex={ci + 1}
            aria-selected={selected}
            class="relative flex h-7 shrink-0 items-center border-r border-b border-outline-variant px-2
              text-data {cell.numeric ? 'justify-end tabular-nums' : ''}
              {dirty ? 'bg-grid-edited' : ''}
              {selected ? 'outline outline-1 -outline-offset-1 outline-primary' : ''}
              {edit?.rowState(r) === 'deleted' ? 'text-on-surface-muted line-through' : 'text-on-surface-variant'}"
            style="width:{colWidths[ci]}px"
            title={cell.title}
            onclick={() => select(dr, c, true)}
            ondblclick={() => startEdit(dr, c)}
          >
            {#if editing && editing.r === dr && editing.c === c}
              <input
                use:focusSelect
                bind:value={draft}
                class="absolute inset-0 h-full w-full border border-primary bg-surface-container-high px-2 text-data text-on-surface outline-none"
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

  {#if inspecting && selectedValue && selectedColumn}
    <CellInspector
      column={selectedColumn}
      value={selectedValue}
      onclose={() => {
        inspecting = false;
        grid?.focus();
      }}
    />
  {/if}
</div>
