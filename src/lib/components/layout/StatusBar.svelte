<script lang="ts">
  import PanelLeft from "@lucide/svelte/icons/panel-left";
  import Sun from "@lucide/svelte/icons/sun";
  import Moon from "@lucide/svelte/icons/moon";
  import SettingsIcon from "@lucide/svelte/icons/settings";
  import IconButton from "$lib/components/ui/IconButton.svelte";
  import Badge from "$lib/components/ui/Badge.svelte";
  import SettingsModal from "$lib/components/settings/SettingsModal.svelte";
  import { theme, DARK_THEMES } from "$lib/stores/theme.svelte";
  import { connections } from "$lib/stores/connections.svelte";
  import { editorTabs } from "$lib/stores/tabs.svelte";
  import type { Engine } from "$lib/api/types";

  interface Props {
    onToggleSidebar: () => void;
  }
  let { onToggleSidebar }: Props = $props();

  const ENGINE_TAG: Record<Engine, string> = { postgres: "PG", mysql: "MY", sqlite: "SQ" };

  // Query stats for the active editor tab's shown statement (DESIGN §5).
  const tab = $derived(editorTabs.active);
  const stmt = $derived(tab && tab.result ? tab.result.statements[tab.activeStatement] : undefined);
  const tx = $derived(tab?.result?.txStatus ?? "idle");
  const isDark = $derived(DARK_THEMES.includes(theme.current));
  let showSettings = $state(false);
  // Quick toggle jumps between the two defaults; the picker (settings) has the rest.
  function toggleTheme(): void {
    theme.set(isDark ? "basalt-light" : "basalt-dark");
  }
</script>

<footer
  class="flex h-6 shrink-0 items-center gap-2 border-t border-border bg-bg-1 px-2
    font-mono text-[11px] text-fg-2"
>
  <IconButton icon={PanelLeft} title="Toggle sidebar" size="sm" onclick={onToggleSidebar} />
  {#if connections.active}
    <Badge variant="ok">{ENGINE_TAG[connections.active.engine]}</Badge>
    <span class="text-fg-1">connected{connections.active.readOnly ? " · read-only" : ""}</span>
  {:else}
    <span>Not connected</span>
  {/if}

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
  <span class="tabular-nums">{theme.current}</span>
  <IconButton icon={isDark ? Sun : Moon} title="Toggle light/dark" size="sm" onclick={toggleTheme} />
  <IconButton icon={SettingsIcon} title="Settings" size="sm" onclick={() => (showSettings = true)} />
</footer>

{#if showSettings}
  <SettingsModal onclose={() => (showSettings = false)} />
{/if}
