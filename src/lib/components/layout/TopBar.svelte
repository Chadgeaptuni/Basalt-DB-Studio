<script lang="ts">
  import Palette from "@lucide/svelte/icons/palette";
  import SearchIcon from "@lucide/svelte/icons/search";
  import BrandMark from "$lib/components/ui/BrandMark.svelte";
  import IconButton from "$lib/components/ui/IconButton.svelte";
  import Kbd from "$lib/components/ui/Kbd.svelte";
  import { stateLayer, focusRing } from "$lib/components/ui/stateLayer";
  import { palette } from "$lib/stores/palette.svelte";
  import { settingsDialog } from "$lib/stores/settingsDialog.svelte";
  import WindowControls from "./WindowControls.svelte";
  import { IS_MAC, MAC_TRAFFIC_LIGHT_INSET } from "$lib/utils/platform";

  // The title bar (the native one is gone — see `drop_native_titlebar` in lib.rs)
  // and nothing else. It carries the mark, the one global search entry, and quick
  // access to appearance.
  //
  // What used to be here and is not any more: the connection switcher, which is
  // run state and belongs beside the transaction badge in the status bar; and
  // settings, which is an app-level destination and belongs at the foot of the
  // rail. A top bar holding session state, navigation and app settings at once is
  // three bars wearing one hat.
  //
  // 40px, the toolbar tier (DESIGN §5) rather than M3's 56px standard: with three
  // controls on it, the taller bar was mostly empty, and 16px of window is worth
  // more to a data tool as grid.
  //
  // Three fixed columns, not flex-grow: the search stays centred in the window no
  // matter how wide the leading mark or the trailing actions get.
  const padding = $derived(
    IS_MAC ? `padding-left:${MAC_TRAFFIC_LIGHT_INSET}px;padding-right:8px` : "padding:0 4px 0 8px",
  );
</script>

<!-- `deep` drags from anywhere in the subtree, and Tauri's own hit test excludes
     buttons, inputs and interactive roles — so the whole bar is a drag handle
     without every control having to opt out of it. Double-click still maximizes. -->
<header
  data-tauri-drag-region="deep"
  style={padding}
  class="grid h-10 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b
    border-outline-variant bg-surface-container"
>
  <div class="flex min-w-0 items-center">
    <BrandMark size={18} />
  </div>

  <!-- The palette's visible affordance. A button, not a real field: focus goes to
       the field inside the dialog, so a second input here would be a decoy. -->
  <button
    type="button"
    onclick={palette.show}
    class="flex h-7 w-80 max-w-full items-center gap-2 rounded-full bg-surface-container-low px-3
      text-on-surface-muted {stateLayer} {focusRing}"
  >
    <SearchIcon size={14} strokeWidth={2} class="shrink-0" />
    <span class="min-w-0 flex-1 truncate text-left text-body-sm">Search tables, queries, actions…</span>
    <Kbd combo="mod+k" />
  </button>

  <div class="flex min-w-0 items-center justify-end gap-1">
    <IconButton
      icon={Palette}
      title="Appearance"
      size="sm"
      onclick={() => settingsDialog.open("appearance")}
    />
    <WindowControls />
  </div>
</header>
