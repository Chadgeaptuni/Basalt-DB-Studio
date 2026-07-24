<script lang="ts">
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import Check from "@lucide/svelte/icons/check";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";
  import Spinner from "$lib/components/ui/Spinner.svelte";
  import EmptyState from "$lib/components/ui/EmptyState.svelte";
  import Badge from "$lib/components/ui/Badge.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import IconButton from "$lib/components/ui/IconButton.svelte";
  import DataGrid, { type EditController } from "./DataGrid.svelte";
  import { parseCell } from "./tableEdits";
  import { tableData } from "$lib/stores/tableData.svelte";
  import { connections } from "$lib/stores/connections.svelte";
  import { confirm } from "$lib/stores/dialogs.svelte";
  import type { EditorTab } from "$lib/stores/tabs.svelte";
  import type { CellValue } from "$lib/api/types";

  interface Props {
    tab: EditorTab;
  }
  let { tab }: Props = $props();

  const sess = $derived(connections.active);
  const view = $derived(tableData.get(tab.id));
  const browse = $derived(view?.browse ?? null);
  const columns = $derived(browse?.columns ?? []);
  const existingCount = $derived(browse?.rows.length ?? 0);
  const pending = $derived(tableData.pending(tab.id));

  let selectedRow = $state<number | null>(null);

  // Load on first show / when the underlying session changes. Staging is keyed by
  // tab id and survives tab switches; it's dropped by editorTabs.close on close.
  $effect(() => {
    const s = sess;
    const ref = tab.ref;
    if (s && ref && !tableData.get(tab.id)) {
      void tableData.load(tab.id, s.sessionId, ref.namespace, ref.table);
    }
  });

  const NULL: CellValue = { kind: "null" };

  // Existing rows with staged overrides, then any inserted rows.
  const gridRows: CellValue[][] = $derived.by(() => {
    if (!browse || !view) return [];
    const existing = browse.rows.map((r, ri) => r.map((cell, ci) => view.edits[ri]?.[ci] ?? cell));
    const inserts = view.inserts.map((ins) => columns.map((_, ci) => ins.cells[ci] ?? NULL));
    return [...existing, ...inserts];
  });

  const controller = $derived<EditController>({
    rowState: (r) =>
      r >= existingCount ? "inserted" : tableData.isDeleted(tab.id, r) ? "deleted" : "normal",
    isDirty: (r, c) =>
      r >= existingCount
        ? view?.inserts[r - existingCount]?.cells[c] !== undefined
        : view?.edits[r]?.[c] !== undefined,
    commit: (r, c, raw) => {
      const kind = r >= existingCount ? "text" : (browse?.rows[r]?.[c]?.kind ?? "text");
      const value = parseCell(raw, kind);
      if (r >= existingCount) tableData.setInsertCell(tab.id, r - existingCount, c, value);
      else tableData.setCell(tab.id, r, c, value);
    },
    setNull: (r, c) => {
      if (r >= existingCount) tableData.setInsertCell(tab.id, r - existingCount, c, NULL);
      else tableData.setCell(tab.id, r, c, NULL);
    },
    toggleDelete: (r) => {
      if (r < existingCount) tableData.toggleDelete(tab.id, r);
    },
    onSelect: (r) => (selectedRow = r),
  });

  const canDeleteSelected = $derived(
    browse?.editable === true && selectedRow !== null && selectedRow < existingCount,
  );

  function deleteSelectedRow(): void {
    if (selectedRow !== null && selectedRow < existingCount) tableData.toggleDelete(tab.id, selectedRow);
  }

  async function doCommit(): Promise<void> {
    if (!sess) return;
    const deletes = tableData.deletes(tab.id);
    if (deletes > 0) {
      const ok = await confirm({
        title: "Commit changes?",
        message: `${pending} change(s), including ${deletes} row deletion(s), will be written.`,
        confirmLabel: "Commit",
        variant: "danger",
      });
      if (!ok) return;
    }
    await tableData.commit(tab.id, sess.sessionId);
  }

  function refresh(): void {
    const ref = tab.ref;
    if (sess && ref) void tableData.load(tab.id, sess.sessionId, ref.namespace, ref.table);
  }
</script>

<div class="flex h-full flex-col bg-bg-0">
  <div class="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-bg-1 px-2">
    <span class="font-mono text-xs text-fg-1">{tab.ref?.namespace}.{tab.ref?.table}</span>
    {#if browse}
      <span class="font-mono text-[11px] text-fg-2 tabular-nums">
        {browse.rows.length} rows{browse.truncated ? " (limit)" : ""}
      </span>
    {/if}
    {#if browse && !browse.editable}
      <Badge variant="warn">read-only</Badge>
    {/if}
    <div class="flex-1"></div>
    {#if pending > 0}
      <span class="font-mono text-[11px] text-accent tabular-nums">{pending} pending</span>
    {/if}
    {#if browse?.editable}
      <IconButton icon={Plus} title="Add row" size="sm" onclick={() => tableData.addRow(tab.id)} />
      <IconButton
        icon={Trash2}
        title="Delete selected row"
        size="sm"
        disabled={!canDeleteSelected}
        onclick={deleteSelectedRow}
      />
      <IconButton
        icon={RotateCcw}
        title="Revert changes"
        size="sm"
        disabled={pending === 0}
        onclick={() => tableData.revert(tab.id)}
      />
      <Button
        variant="primary"
        size="sm"
        disabled={pending === 0}
        loading={view?.committing}
        onclick={doCommit}
      >
        <Check size={13} strokeWidth={2} /> Commit
      </Button>
    {/if}
    <IconButton icon={RefreshCw} title="Refresh" size="sm" onclick={refresh} />
  </div>

  {#if browse?.editable === false && browse.notEditableReason}
    <div class="flex items-center gap-2 border-b border-border px-3 py-1.5 text-xs text-fg-2">
      <TriangleAlert size={13} strokeWidth={2} class="shrink-0 text-warn" />
      {browse.notEditableReason}
    </div>
  {/if}
  {#if view?.commitError}
    <div class="flex items-start gap-2 border-b border-border px-3 py-1.5 text-xs">
      <TriangleAlert size={13} strokeWidth={2} class="mt-0.5 shrink-0 text-danger" />
      <span class="font-mono whitespace-pre-wrap text-danger">{view.commitError.message}</span>
    </div>
  {/if}

  <div class="min-h-0 flex-1 overflow-hidden">
    {#if !view || view.loading}
      <div class="flex items-center gap-2 p-3 text-sm text-fg-2"><Spinner size="sm" /> Loading rows…</div>
    {:else if view.error}
      <div class="flex items-start gap-2 p-3 text-sm">
        <TriangleAlert size={16} strokeWidth={2} class="mt-0.5 shrink-0 text-danger" />
        <span class="font-mono text-xs whitespace-pre-wrap text-fg-2">{view.error.message}</span>
      </div>
    {:else if gridRows.length === 0}
      <EmptyState message="No rows. Use Add row to insert one." />
    {:else}
      <DataGrid {columns} rows={gridRows} edit={browse?.editable ? controller : undefined} />
    {/if}
  </div>
</div>
