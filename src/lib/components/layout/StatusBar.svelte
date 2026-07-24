<script lang="ts">
  import PanelLeft from "@lucide/svelte/icons/panel-left";
  import Sun from "@lucide/svelte/icons/sun";
  import Moon from "@lucide/svelte/icons/moon";
  import IconButton from "$lib/components/ui/IconButton.svelte";
  import Badge from "$lib/components/ui/Badge.svelte";
  import { theme } from "$lib/stores/theme.svelte";
  import { connections } from "$lib/stores/connections.svelte";
  import type { Engine } from "$lib/api/types";

  interface Props {
    onToggleSidebar: () => void;
  }
  let { onToggleSidebar }: Props = $props();

  const ENGINE_TAG: Record<Engine, string> = { postgres: "PG", mysql: "MY", sqlite: "SQ" };
  const isDark = $derived(theme.current === "basalt-dark");
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
  <div class="flex-1"></div>
  <span class="tabular-nums">{theme.current}</span>
  <IconButton
    icon={isDark ? Sun : Moon}
    title="Toggle theme"
    size="sm"
    onclick={toggleTheme}
  />
</footer>
