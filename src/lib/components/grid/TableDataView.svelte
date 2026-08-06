<script lang="ts">
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import Check from "@lucide/svelte/icons/check";
  import Download from "@lucide/svelte/icons/download";
  import Upload from "@lucide/svelte/icons/upload";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";
  import Spinner from "$lib/components/ui/Spinner.svelte";
  import EmptyState from "$lib/components/ui/EmptyState.svelte";
  import Badge from "$lib/components/ui/Badge.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import IconButton from "$lib/components/ui/IconButton.svelte";
  import SplitPane from "$lib/components/ui/SplitPane.svelte";
  import EditorPane from "$lib/components/editor/EditorPane.svelte";
  import DataGrid, { type EditController } from "./DataGrid.svelte";
  import ResultsPane from "./ResultsPane.svelte";
  import ImportWizard from "$lib/components/importExport/ImportWizard.svelte";
  import { runExport } from "$lib/components/importExport/runExport";
  import { parseCell } from "./tableEdits";
  import { tableData } from "$lib/stores/tableData.svelte";
  import { connections } from "$lib/stores/connections.svelte";
  import { confirm } from "$lib/stores/dialogs.svelte";
  import { ioApi } from "$lib/api/io";
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

  // The statement the backend actually ran for these rows. Running it unchanged
  // reloads the editable grid; anything else is an arbitrary query, whose result
  // has no table provenance and so is read-only (DESIGN §10).
  const canonicalSql = $derived(browse?.sql ?? "");
  const queryMode = $derived(
    Boolean(tab.lastRunSql) && tab.lastRunSql !== canonicalSql && canonicalSql !== "",
  );

  let selectedRow = $state<number | null>(null);
  let showImport = $state(false);

  function exportTable(): void {
    const ref = tab.ref;
    if (!sess || !ref) return;
    void runExport(`${ref.table}.csv`, (format, path) =>
      ioApi.exportTable(sess.sessionId, ref.namespace, ref.table, format, path),
    );
  }

  // Load on first show / when the underlying session changes. Staging is keyed by
  // tab id and survives tab switches; it's dropped by editorTabs.close on close.
  $effect(() => {
    const s = sess;
    const ref = tab.ref;
    if (s && ref && !tableData.get(tab.id)) {
      void tableData.load(tab.id, s.sessionId, ref.namespace, ref.table);
    }
  });

  // Seed the editor with the browse SQL once it's known. Only when the buffer is
  // still empty — a reload must never overwrite what the user is editing.
  $effect(() => {
    if (canonicalSql && !tab.sql) tab.sql = canonicalSql;
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

  // The single reload path (refresh, rerunning the canonical query, reset). It is
  // also the only thing that drops staged edits, so the guard lives here once.
  async function reload(): Promise<void> {
    const ref = tab.ref;
    if (!sess || !ref) return;
    if (pending > 0) {
      const ok = await confirm({
        title: "Discard staged changes?",
        message: `${pending} uncommitted change(s) will be lost when the rows reload.`,
        confirmLabel: "Discard",
        variant: "danger",
      });
      if (!ok) return;
    }
    await tableData.load(tab.id, sess.sessionId, ref.namespace, ref.table);
    tab.lastRunSql = tableData.get(tab.id)?.browse?.sql ?? null;
  }

  async function resetToTableQuery(): Promise<void> {
    await reload();
    tab.sql = tableData.get(tab.id)?.browse?.sql ?? tab.sql;
  }
</script>

<!-- Same vertical structure as a SQL tab, with a smaller editor share so the rows
     stay the dominant surface (DESIGN §5). -->
<SplitPane direction="vertical" initial={0.28} min={80} label="Resize query and rows">
  {#snippet a()}
    <EditorPane {canonicalSql} onCanonicalRun={reload} />
  {/snippet}
  {#snippet b()}
<div class="flex h-full flex-col bg-surface">
  <div class="flex h-10 shrink-0 items-center gap-2 border-b border-outline-variant bg-surface-container px-2">
    <span class="text-data text-on-surface-variant">{tab.ref?.namespace}.{tab.ref?.table}</span>
    {#if browse && !queryMode}
      <span class="text-data text-on-surface-muted tabular-nums">
        {browse.rows.length} rows{browse.truncated ? " (limit)" : ""}
      </span>
    {/if}
    {#if browse && !browse.editable && !queryMode}
      <Badge variant="warn">read-only</Badge>
    {/if}
    <div class="flex-1"></div>
    {#if pending > 0}
      <span class="text-data text-primary tabular-nums">{pending} pending</span>
    {/if}
    {#if browse?.editable && !queryMode}
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
      <IconButton icon={Upload} title="Import CSV" size="sm" onclick={() => (showImport = true)} />
    {/if}
    {#if !queryMode}
      <IconButton icon={Download} title="Export" size="sm" disabled={!browse} onclick={exportTable} />
    {/if}
    <IconButton icon={RefreshCw} title="Refresh" size="sm" onclick={() => void reload()} />
  </div>

  {#if queryMode}
    <div class="flex items-center gap-2 border-b border-outline-variant px-3 py-1.5 text-body-sm text-on-surface-muted">
      <TriangleAlert size={13} strokeWidth={2} class="shrink-0 text-warn" />
      <span class="min-w-0 flex-1">
        Showing an edited query. Its rows can't be traced back to
        <span class="font-mono">{tab.ref?.namespace}.{tab.ref?.table}</span>, so they're read-only.
      </span>
      <Button size="sm" onclick={() => void resetToTableQuery()}>Reset to table query</Button>
    </div>
  {/if}
  {#if browse?.editable === false && browse.notEditableReason}
    <div class="flex items-center gap-2 border-b border-outline-variant px-3 py-1.5 text-body-sm text-on-surface-muted">
      <TriangleAlert size={13} strokeWidth={2} class="shrink-0 text-warn" />
      {browse.notEditableReason}
    </div>
  {/if}
  {#if view?.commitError}
    <div class="flex items-start gap-2 border-b border-outline-variant px-3 py-1.5 text-body-sm">
      <TriangleAlert size={13} strokeWidth={2} class="mt-0.5 shrink-0 text-error" />
      <span class="font-mono whitespace-pre-wrap text-error">{view.commitError.message}</span>
    </div>
  {/if}

  <div class="min-h-0 flex-1 overflow-hidden">
    {#if queryMode}
      <ResultsPane />
    {:else if !view || view.loading}
      <div class="flex items-center gap-2 p-3 text-body-md text-on-surface-muted"><Spinner size="sm" /> Loading rows…</div>
    {:else if view.error}
      <div class="flex items-start gap-2 p-3 text-body-md">
        <TriangleAlert size={16} strokeWidth={2} class="mt-0.5 shrink-0 text-error" />
        <span class="text-data whitespace-pre-wrap text-on-surface-muted">{view.error.message}</span>
      </div>
    {:else if gridRows.length === 0}
      <EmptyState message="No rows. Use Add row to insert one." />
    {:else}
      <DataGrid
        label={tab.ref ? `Table data for ${tab.ref.namespace}.${tab.ref.table}` : "Table data"}
        {columns}
        rows={gridRows}
        truncated={browse?.truncated ?? false}
        edit={browse?.editable ? controller : undefined}
      />
    {/if}
  </div>
</div>
  {/snippet}
</SplitPane>

{#if showImport && tab.ref}
  <ImportWizard
    namespace={tab.ref.namespace}
    table={tab.ref.table}
    columns={columns.map((c) => c.name)}
    onclose={() => (showImport = false)}
  />
{/if}
