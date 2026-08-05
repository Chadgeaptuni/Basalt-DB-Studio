<script lang="ts">
  import PanelLeft from "@lucide/svelte/icons/panel-left";
  import IconButton from "$lib/components/ui/IconButton.svelte";
  import Badge from "$lib/components/ui/Badge.svelte";
  import { zoom } from "$lib/stores/zoom.svelte";
  import { keyboard } from "$lib/utils/keyboard";
  import { editorTabs } from "$lib/stores/tabs.svelte";

  // Run state only: connection identity lives in the top bar, theme and settings
  // in its right-hand group. What stays here is per-run (DESIGN §5).
  interface Props {
    onToggleSidebar: () => void;
  }
  let { onToggleSidebar }: Props = $props();

  // Query stats for the active editor tab's shown statement (DESIGN §5).
  const tab = $derived(editorTabs.active);
  const stmt = $derived(tab && tab.result ? tab.result.statements[tab.activeStatement] : undefined);
  const tx = $derived(tab?.result?.txStatus ?? "idle");
</script>

<footer
  class="flex h-6 shrink-0 items-center gap-2 border-t border-outline-variant bg-surface-container px-2
    font-mono text-[11px] text-on-surface-muted"
>
  <IconButton icon={PanelLeft} title="Toggle sidebar" size="sm" onclick={onToggleSidebar} />

  {#if tx === "inTx"}
    <Badge variant="warn">TX</Badge>
  {:else if tx === "error"}
    <Badge variant="danger">TX ERR</Badge>
  {/if}
  {#if stmt && !stmt.error}
    <span class="tabular-nums">
      {#if stmt.columns.length > 0}
        {stmt.rows.length} rows{stmt.truncated ? " (limit)" : ""} · {stmt.durationMs} ms
      {:else}
        {stmt.rowsAffected} affected · {stmt.durationMs} ms
      {/if}
    </span>
  {/if}

  <div class="flex-1"></div>
  <button
    type="button"
    class="tabular-nums transition-colors hover:text-on-surface-variant"
    title="Display size — click to reset ({keyboard.label('mod+0')})"
    onclick={zoom.reset}
  >
    {Math.round(zoom.level * 100)}%
  </button>
</footer>
