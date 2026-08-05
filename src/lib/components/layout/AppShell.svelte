<script lang="ts">
  import Sidebar from "./Sidebar.svelte";
  import StatusBar from "./StatusBar.svelte";
  import StartPanel from "./StartPanel.svelte";
  import Workspace from "$lib/components/workspace/Workspace.svelte";
  import { connections } from "$lib/stores/connections.svelte";
  import { keyboard } from "$lib/utils/keyboard";
  import { zoom } from "$lib/stores/zoom.svelte";

  let sidebarOpen = $state(true);

  // All global shortcuts go through the single registry (DESIGN §7). Zoom mirrors
  // VSCode: Cmd/Ctrl + = (in), - (out), 0 (reset).
  $effect(() => {
    const offs = [
      keyboard.register("mod+b", () => (sidebarOpen = !sidebarOpen)),
      keyboard.register("mod+=", zoom.in),
      keyboard.register("mod+-", zoom.out),
      keyboard.register("mod+0", zoom.reset),
    ];
    return () => offs.forEach((off) => off());
  });
</script>

<div class="flex h-full flex-col">
  <div class="flex flex-1 overflow-hidden">
    {#if sidebarOpen}<Sidebar />{/if}
    <main class="flex-1 overflow-hidden bg-bg-0">
      {#if connections.active}
        <Workspace />
      {:else}
        <StartPanel />
      {/if}
    </main>
  </div>
  <StatusBar onToggleSidebar={() => (sidebarOpen = !sidebarOpen)} />
</div>
