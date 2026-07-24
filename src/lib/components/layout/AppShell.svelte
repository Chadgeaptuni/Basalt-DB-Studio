<script lang="ts">
  import Terminal from "@lucide/svelte/icons/terminal";
  import Sidebar from "./Sidebar.svelte";
  import StatusBar from "./StatusBar.svelte";
  import EmptyState from "$lib/components/ui/EmptyState.svelte";
  import { keyboard } from "$lib/utils/keyboard";

  let sidebarOpen = $state(true);

  // Ctrl/Cmd+B toggles the sidebar via the single shortcut registry (DESIGN §7).
  $effect(() => keyboard.register("mod+b", () => (sidebarOpen = !sidebarOpen)));
</script>

<div class="flex h-full flex-col">
  <div class="flex flex-1 overflow-hidden">
    {#if sidebarOpen}<Sidebar />{/if}
    <main class="flex-1 overflow-hidden bg-bg-0">
      <!-- M1 slots the editor/results SplitPane here. -->
      <EmptyState icon={Terminal} message="Connect to a database to start querying." />
    </main>
  </div>
  <StatusBar onToggleSidebar={() => (sidebarOpen = !sidebarOpen)} />
</div>
