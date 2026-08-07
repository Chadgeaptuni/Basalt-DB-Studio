<script lang="ts">
  import NavRail from "./NavRail.svelte";
  import PanelHost from "./PanelHost.svelte";
  import TopBar from "./TopBar.svelte";
  import StatusBar from "./StatusBar.svelte";
  import StartPanel from "./StartPanel.svelte";
  import Workspace from "$lib/components/workspace/Workspace.svelte";
  import CommandPalette from "$lib/components/command/CommandPalette.svelte";
  import SettingsModal from "$lib/components/settings/SettingsModal.svelte";
  import { connections } from "$lib/stores/connections.svelte";
  import { panel } from "$lib/stores/panel.svelte";
  import { palette } from "$lib/stores/palette.svelte";
  import { settingsDialog } from "$lib/stores/settingsDialog.svelte";
  import { keyboard } from "$lib/utils/keyboard";
  import { zoom } from "$lib/stores/zoom.svelte";

  // Top app bar over rail · panel · main, with the status bar underneath
  // (DESIGN §5). The rail is always mounted; the panel it drives is what
  // `mod+b` hides.
  //
  // All global shortcuts go through the single registry (DESIGN §7). Zoom mirrors
  // VSCode: Cmd/Ctrl + = (in), - (out), 0 (reset).
  $effect(() => {
    const offs = [
      keyboard.register("mod+k", palette.toggle),
      keyboard.register("mod+b", panel.toggleCollapsed),
      keyboard.register("mod+=", zoom.in),
      keyboard.register("mod+-", zoom.out),
      keyboard.register("mod+0", zoom.reset),
    ];
    return () => offs.forEach((off) => off());
  });
</script>

<div class="flex h-full flex-col">
  <TopBar />
  <div class="flex flex-1 overflow-hidden">
    <NavRail />
    {#if !panel.collapsed}<PanelHost />{/if}
    <main class="min-w-0 flex-1 overflow-hidden bg-surface">
      {#if connections.active}
        <Workspace />
      {:else}
        <StartPanel />
      {/if}
    </main>
  </div>
  <StatusBar />
</div>

<!-- Both overlays are hosted here, once, because more than one surface opens each
     of them and none of those surfaces contains the others (DESIGN §9). -->
{#if palette.open}
  <CommandPalette onclose={palette.close} />
{/if}

{#if settingsDialog.tab}
  <SettingsModal initialTab={settingsDialog.tab} onclose={settingsDialog.close} />
{/if}
