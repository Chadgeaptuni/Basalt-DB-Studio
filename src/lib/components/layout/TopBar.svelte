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
  import { theme } from "$lib/stores/theme.svelte";

  // Three fixed columns, not flex-grow: the centre control stays centred in the
  // window no matter how wide the left mark or the right actions get (DESIGN §5).
  let settingsTab = $state<SettingsTab | null>(null);
</script>

<header
  class="grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-outline-variant
    bg-surface-container px-3"
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

  <div class="flex min-w-0 items-center justify-end">
    <IconButton
      icon={theme.isLight ? Moon : Sun}
      title={theme.isLight ? "Switch to dark" : "Switch to light"}
      size="sm"
      onclick={theme.toggleAppearance}
    />
    <IconButton icon={Palette} title="Appearance" size="sm" onclick={() => (settingsTab = "appearance")} />
    <IconButton icon={SettingsIcon} title="Settings" size="sm" onclick={() => (settingsTab = "general")} />
  </div>
</header>

{#if settingsTab}
  <SettingsModal initialTab={settingsTab} onclose={() => (settingsTab = null)} />
{/if}
