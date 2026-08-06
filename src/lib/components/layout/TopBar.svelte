<script lang="ts">
  import Sun from "@lucide/svelte/icons/sun";
  import Moon from "@lucide/svelte/icons/moon";
  import Palette from "@lucide/svelte/icons/palette";
  import SettingsIcon from "@lucide/svelte/icons/settings";
  import BrandMark from "$lib/components/ui/BrandMark.svelte";
  import IconButton from "$lib/components/ui/IconButton.svelte";
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
  <div class="flex min-w-0 items-center gap-2">
    <BrandMark size={20} />
    <span class="truncate text-title-md text-on-surface">Basalt</span>
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
