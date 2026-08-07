<script lang="ts">
  import Minus from "@lucide/svelte/icons/minus";
  import Square from "@lucide/svelte/icons/square";
  import Copy from "@lucide/svelte/icons/copy";
  import X from "@lucide/svelte/icons/x";
  import IconButton from "$lib/components/ui/IconButton.svelte";
  import { windowApi } from "$lib/api/window";
  import { USE_CUSTOM_WINDOW_CONTROLS } from "$lib/utils/platform";

  // Minimize / maximize / close for the platforms whose native chrome we dropped.
  // macOS renders nothing here: it keeps its own traffic lights via the overlay
  // title bar, and a second set of buttons on the opposite edge would be two ways
  // to close one window.
  //
  // A layout component rather than a `ui/` primitive — it reads the api layer,
  // which `ui/` may not (DESIGN §9).
  const show = USE_CUSTOM_WINDOW_CONTROLS && windowApi.available;

  let maximized = $state(false);

  // The maximize glyph has to follow the window: it is the only feedback that the
  // button restores rather than maximizes, and the window can get there without
  // this button (drag to the top edge, double-click the bar, Win+Up).
  $effect(() => (show ? windowApi.onMaximizeChange((v) => (maximized = v)) : undefined));
</script>

{#if show}
  <div class="flex shrink-0 items-center">
    <!-- App actions and window actions are different kinds of thing, and the rule
         keeps a mis-aimed click off Close. It belongs to this component so it can
         never outlive the buttons it separates. -->
    <span class="mx-1 h-5 w-px shrink-0 bg-outline-variant"></span>
    <IconButton icon={Minus} title="Minimize" size="sm" onclick={windowApi.minimize} />
    <IconButton
      icon={maximized ? Copy : Square}
      title={maximized ? "Restore" : "Maximize"}
      size="sm"
      onclick={windowApi.toggleMaximize}
    />
    <IconButton icon={X} title="Close" size="sm" tone="danger" onclick={windowApi.close} />
  </div>
{/if}
