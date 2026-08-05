<script lang="ts">
  import Play from "@lucide/svelte/icons/play";
  import WrapText from "@lucide/svelte/icons/wrap-text";
  import Save from "@lucide/svelte/icons/save";
  import Button from "$lib/components/ui/Button.svelte";
  import IconButton from "$lib/components/ui/IconButton.svelte";
  import CodeEditor from "./CodeEditor.svelte";
  import { schemaFrom } from "./cm";
  import { editorTabs } from "$lib/stores/tabs.svelte";
  import { saveQuery } from "$lib/stores/saveQuery.svelte";
  import { settings } from "$lib/stores/settings.svelte";
  import { connections } from "$lib/stores/connections.svelte";
  import { schema } from "$lib/stores/schema.svelte";
  import { history } from "$lib/stores/history.svelte";
  import { queryApi } from "$lib/api/query";
  import { confirm } from "$lib/stores/dialogs.svelte";
  import { toast } from "$lib/stores/toasts.svelte";
  import { keyboard } from "$lib/utils/keyboard";
  import type { ApiError } from "$lib/api/client";
  import type { Engine } from "$lib/api/types";

  // Table tabs hand in the SQL that owns the editable grid: running it unchanged
  // must go back through table browse (which keeps row provenance), not the query
  // API. Everything else — editor, shortcuts, formatter, history — is shared.
  interface Props {
    canonicalSql?: string | null;
    onCanonicalRun?: () => void | Promise<void>;
  }
  let { canonicalSql = null, onCanonicalRun }: Props = $props();

  const tab = $derived(editorTabs.active);
  const sess = $derived(connections.active);
  const dialect = $derived<Engine>(sess?.engine ?? "postgres");
  const canRun = $derived(Boolean(sess) && Boolean(tab) && !tab?.running);

  // Autocomplete schema straight from the in-memory cache (DESIGN §10). Recomputes
  // only when the tree or a described table changes, keeping CM reconfig cheap.
  const cmSchema = $derived(
    schemaFrom(sess ? schema.get(sess.sessionId)?.tree : undefined, (ns, table) =>
      sess ? schema.describeCached(sess.sessionId, ns, table)?.columns.map((c) => c.name) : undefined,
    ),
  );

  const FORMATTER_LANG: Record<Engine, "postgresql" | "mysql" | "sqlite"> = {
    postgres: "postgresql",
    mysql: "mysql",
    sqlite: "sqlite",
  };

  function setSql(v: string): void {
    if (tab) tab.sql = v;
  }

  async function runOnce(
    payload: { sql: string; cursorOffset?: number },
    confirmed: boolean,
  ): Promise<void> {
    if (!tab || !sess) return;
    const result = await queryApi.run(sess.sessionId, payload.sql, {
      cursorOffset: payload.cursorOffset,
      confirmed,
      limit: settings.defaultRowLimit,
    });
    tab.result = result;
    tab.lastRunSql = payload.sql;
    tab.activeStatement = 0;
    const rows = result.statements.reduce((n, s) => n + s.rows.length, 0);
    const durationMs = result.statements.reduce((n, s) => n + s.durationMs, 0);
    const hasRows = result.statements.some((s) => s.columns.length > 0);
    history.push({
      sql: payload.sql,
      engine: sess.engine,
      ok: !result.statements.some((s) => s.error),
      rowCount: hasRows ? rows : null,
      durationMs,
    });
  }

  async function handleRun(payload: { sql: string; cursorOffset?: number }): Promise<void> {
    if (!tab || !sess || !payload.sql.trim()) return;
    if (onCanonicalRun && payload.sql.trim() === canonicalSql?.trim()) {
      await onCanonicalRun();
      return;
    }
    tab.running = true;
    tab.runError = null;
    tab.runStartedAt = Date.now();
    try {
      await runOnce(payload, false);
    } catch (e) {
      const err = e as ApiError;
      if (err.kind === "confirmationRequired") {
        if (await confirmDestructive(err)) {
          try {
            await runOnce(payload, true);
          } catch (e2) {
            tab.runError = e2 as ApiError;
          }
        }
      } else {
        tab.runError = err;
        if (err.kind === "internal") toast.error(err.message);
      }
    } finally {
      tab.running = false;
      tab.runStartedAt = null;
    }
  }

  async function confirmDestructive(err: ApiError): Promise<boolean> {
    const detail = err.detail as { statements?: { statement: string; reason: string }[] } | undefined;
    const list = detail?.statements ?? [];
    const message =
      list.length === 1
        ? `${list[0].reason}\n\n${list[0].statement}`
        : `${list.length} destructive statements:\n\n${list.map((s) => `• ${s.reason}`).join("\n")}`;
    return confirm({ title: "Run destructive statement?", message, confirmLabel: "Run", variant: "danger" });
  }

  async function format(): Promise<void> {
    if (!tab || !tab.sql.trim()) return;
    try {
      const { format: fmt } = await import("sql-formatter");
      tab.sql = fmt(tab.sql, { language: FORMATTER_LANG[dialect] });
    } catch {
      toast.error("Could not format SQL");
    }
  }

</script>

<div class="flex h-full flex-col bg-bg-0">
  <div class="flex h-9 shrink-0 items-center gap-1.5 border-b border-border px-2">
    <Button
      variant="primary"
      size="sm"
      disabled={!canRun}
      loading={tab?.running}
      onclick={() => tab && handleRun({ sql: tab.sql })}
    >
      <Play size={13} strokeWidth={2} /> Run
    </Button>
    <span class="font-mono text-[11px] text-fg-2">{keyboard.label("mod+enter")} at cursor</span>
    <div class="flex-1"></div>
    <IconButton
      icon={Save}
      title={`Save query · ${keyboard.label("mod+s")}`}
      size="sm"
      onclick={() => void saveQuery.trigger()}
      disabled={!tab}
    />
    <IconButton icon={WrapText} title={`Format · ${keyboard.label("mod+shift+f")}`} size="sm" onclick={format} disabled={!tab} />
  </div>

  <div class="min-h-0 flex-1">
    {#if tab}
      <CodeEditor
        value={tab.sql}
        {dialect}
        schema={cmSchema}
        onChange={setSql}
        onRun={handleRun}
        onFormat={format}
      />
    {/if}
  </div>
</div>
