<script lang="ts">
  import Play from "@lucide/svelte/icons/play";
  import Download from "@lucide/svelte/icons/download";
  import CircleCheck from "@lucide/svelte/icons/circle-check";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";
  import Spinner from "$lib/components/ui/Spinner.svelte";
  import EmptyState from "$lib/components/ui/EmptyState.svelte";
  import Badge from "$lib/components/ui/Badge.svelte";
  import IconButton from "$lib/components/ui/IconButton.svelte";
  import Tabs, { type TabItem } from "$lib/components/ui/Tabs.svelte";
  import DataGrid from "./DataGrid.svelte";
  import { runExport } from "$lib/components/importExport/runExport";
  import { editorTabs } from "$lib/stores/tabs.svelte";
  import { connections } from "$lib/stores/connections.svelte";
  import { ioApi } from "$lib/api/io";
  import type { ErrorKind, StatementResult } from "$lib/api/types";

  // History used to live here behind a toggle; it is a rail destination now, so
  // this pane only ever shows results (DESIGN §5).
  const tab = $derived(editorTabs.active);
  const result = $derived(tab?.result ?? null);
  const stmts = $derived(result?.statements ?? []);
  const current = $derived<StatementResult | undefined>(stmts[tab?.activeStatement ?? 0]);

  // Live elapsed time while a query runs (DESIGN §8 — mono, in the results toolbar).
  let now = $state(Date.now());
  $effect(() => {
    if (!tab?.running) return;
    const h = setInterval(() => (now = Date.now()), 100);
    return () => clearInterval(h);
  });
  const elapsed = $derived(
    tab?.running && tab.runStartedAt ? ((now - tab.runStartedAt) / 1000).toFixed(1) : "0.0",
  );

  const statementTabs = $derived<TabItem[]>(
    stmts.map((s, i) => ({
      id: String(i),
      label: s.error ? `Error ${i + 1}` : s.columns.length ? `Result ${i + 1}` : `Statement ${i + 1}`,
      tone: s.error ? "danger" : "default",
    })),
  );

  const ERROR_TITLE: Partial<Record<ErrorKind, string>> = {
    readOnlyViolation: "Connection is read-only",
    queryError: "Query error",
    queryCancelled: "Query cancelled",
    noPrimaryKey: "No primary key",
    ambiguousRowIdentity: "Ambiguous row identity",
    connectionRefused: "Connection lost",
    authFailed: "Authentication failed",
    tlsError: "TLS error",
    tunnelError: "Tunnel error",
  };
  const title = (kind: ErrorKind): string => ERROR_TITLE[kind] ?? "Error";

  // Export re-runs the SQL that produced the shown result (full result, not the
  // row-limited page) — never the live draft, which may have moved on since.
  const canExport = $derived(Boolean(connections.active) && Boolean(tab?.lastRunSql) && !tab?.running);
  function exportResult(): void {
    const sess = connections.active;
    const sql = tab?.lastRunSql;
    if (!sess || !sql) return;
    void runExport("query.csv", (format, path) => ioApi.exportQuery(sess.sessionId, sql, format, path));
  }
</script>

<div class="flex h-full flex-col bg-surface">
  <div
    class="flex h-8 shrink-0 items-center gap-2 border-b border-outline-variant bg-surface-container px-2 text-data text-on-surface-muted"
  >
    {#if tab?.running}
      <Spinner size="sm" /> <span>Running… {elapsed}s</span>
    {:else if current && !current.error}
      {#if current.columns.length > 0}
        <span class="tabular-nums text-on-surface-variant">{current.rows.length} rows</span>
        {#if current.truncated}<Badge variant="warn">limit</Badge>{/if}
      {:else}
        <span class="tabular-nums text-on-surface-variant">{current.rowsAffected} affected</span>
      {/if}
      <span class="tabular-nums">· {current.durationMs} ms</span>
    {:else}
      <span>Results</span>
    {/if}
    <div class="flex-1"></div>
    <IconButton icon={Download} title="Export query result" size="sm" disabled={!canExport} onclick={exportResult} />
  </div>

  {#if statementTabs.length > 1}
    <Tabs
      label="Statement results"
      items={statementTabs}
      activeId={String(tab?.activeStatement ?? 0)}
      onSelect={(id) => tab && (tab.activeStatement = Number(id))}
    />
  {/if}

  <div class="min-h-0 flex-1 overflow-hidden">
    {#if !tab}
      <EmptyState icon={Play} message="No editor tab open." />
    {:else if tab.running}
      <div class="flex items-center gap-2 p-3 text-body-md text-on-surface-muted"><Spinner size="sm" /> Running query…</div>
    {:else if tab.runError}
      <div class="flex items-start gap-2 p-3 text-body-md">
        <TriangleAlert size={16} strokeWidth={2} class="mt-0.5 shrink-0 text-error" />
        <div class="min-w-0">
          <div class="text-on-surface">{title(tab.runError.kind)}</div>
          <div class="mt-0.5 text-data whitespace-pre-wrap text-on-surface-muted">{tab.runError.message}</div>
        </div>
      </div>
    {:else if !result}
      <EmptyState icon={Play} message="Run a query to see results." />
    {:else if current?.error}
      <div class="flex items-start gap-2 p-3 text-body-md">
        <TriangleAlert size={16} strokeWidth={2} class="mt-0.5 shrink-0 text-error" />
        <div class="min-w-0">
          <div class="text-on-surface">{title(current.error.kind)}</div>
          <div class="mt-0.5 text-data whitespace-pre-wrap text-on-surface-muted">{current.error.message}</div>
        </div>
      </div>
    {:else if current && current.columns.length === 0}
      <div class="flex items-center gap-2 p-3 text-body-md text-on-surface-variant">
        <CircleCheck size={16} strokeWidth={2} class="shrink-0 text-ok" />
        {current.rowsAffected} row{current.rowsAffected === 1 ? "" : "s"} affected.
      </div>
    {:else if current && current.rows.length === 0}
      <EmptyState icon={Play} message="0 rows returned." />
    {:else if current}
      <DataGrid label="Query results" columns={current.columns} rows={current.rows} />
    {/if}
  </div>
</div>
