<script lang="ts">
  import Sun from "@lucide/svelte/icons/sun";
  import Moon from "@lucide/svelte/icons/moon";
  import Palette from "@lucide/svelte/icons/palette";
  import SettingsIcon from "@lucide/svelte/icons/settings";
  import SearchIcon from "@lucide/svelte/icons/search";
  import BrandMark from "$lib/components/ui/BrandMark.svelte";
  import IconButton from "$lib/components/ui/IconButton.svelte";
  import Kbd from "$lib/components/ui/Kbd.svelte";
  import { stateLayer, focusRing } from "$lib/components/ui/stateLayer";
  import { palette } from "$lib/stores/palette.svelte";
  import ConnectionSwitcher from "$lib/components/connections/ConnectionSwitcher.svelte";
  import SettingsModal, { type SettingsTab } from "$lib/components/settings/SettingsModal.svelte";
  import WindowControls from "./WindowControls.svelte";
  import { theme } from "$lib/stores/theme.svelte";
  import { IS_MAC, MAC_TRAFFIC_LIGHT_INSET } from "$lib/utils/platform";

  // Three fixed columns, not flex-grow: the centre control stays centred in the
  // window no matter how wide the left mark or the right actions get (DESIGN §5).
  let settingsTab = $state<SettingsTab | null>(null);

  // This bar *is* the title bar — the native one is gone on every platform (see
  // tauri.<platform>.conf.json). On macOS the traffic lights float over it, so the
  // leading edge insets to clear them; elsewhere we draw the buttons ourselves and
  // the trailing edge tightens to put close near the corner.
  const padding = $derived(
    IS_MAC ? `padding-left:${MAC_TRAFFIC_LIGHT_INSET}px;padding-right:12px` : "padding:0 4px 0 12px",
  );
</script>

<!-- `deep` drags from anywhere in the subtree, and Tauri's own hit test excludes
     buttons, inputs and interactive roles — so the whole bar is a drag handle
     without every control having to opt out of it. Double-click still maximizes. -->
<header
  data-tauri-drag-region="deep"
  style={padding}
  class="grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-outline-variant
    bg-surface-container"
>
  <div class="flex min-w-0 items-center gap-3">
    <BrandMark size={20} />
    <span class="shrink-0 truncate text-title-md text-on-surface">Basalt</span>
    <!-- The palette's visible affordance. A button, not a real field: focus goes
         to the field inside the dialog, so a second input here would be a decoy. -->
    <button
      type="button"
      onclick={palette.show}
      class="flex h-8 min-w-0 max-w-72 flex-1 items-center gap-2 rounded-full
        bg-surface-container-low px-3 text-on-surface-muted {stateLayer} {focusRing}"
    >
      <SearchIcon size={16} strokeWidth={2} class="shrink-0" />
      <span class="min-w-0 flex-1 truncate text-left text-body-md">Search…</span>
      <Kbd combo="mod+k" />
    </button>
  </div>

  <ConnectionSwitcher />

  <div class="flex min-w-0 items-center justify-end gap-1">
    <IconButton
      icon={theme.isLight ? Moon : Sun}
      title={theme.isLight ? "Switch to dark" : "Switch to light"}
      size="sm"
      onclick={theme.toggleAppearance}
    />
    <IconButton icon={Palette} title="Appearance" size="sm" onclick={() => (settingsTab = "appearance")} />
    <IconButton icon={SettingsIcon} title="Settings" size="sm" onclick={() => (settingsTab = "general")} />

    <WindowControls />
  </div>
</header>

{#if settingsTab}
  <SettingsModal initialTab={settingsTab} onclose={() => (settingsTab = null)} />
{/if}
