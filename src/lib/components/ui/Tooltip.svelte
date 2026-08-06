<script lang="ts">
  import type { Snippet } from "svelte";
  import { Tooltip } from "bits-ui";
  import { uiFade } from "$lib/utils/motion";

  // M3 plain tooltip (DESIGN §6): 400 ms delay, `text-body-sm`, no arrow.
  //
  // It replaces the *native* `title` on icon-only controls — native tooltips take
  // roughly a second, ignore the theme, and render differently on every OS. The
  // label still reaches assistive tech through the trigger's own `aria-label`, so
  // this is decoration: a screen reader never depends on it.
  //
  // `Tooltip.Provider` lives here rather than at the app root because bits-ui
  // scopes "only one open at a time" to the provider, and each of these wraps a
  // single control.
  interface Props {
    label: string;
    side?: "top" | "bottom" | "left" | "right";
    children: Snippet;
  }
  let { label, side = "bottom", children }: Props = $props();
</script>

<Tooltip.Provider delayDuration={400}>
  <Tooltip.Root>
    <Tooltip.Trigger class="contents">
      {@render children()}
    </Tooltip.Trigger>
    <Tooltip.Portal>
      <Tooltip.Content {side} sideOffset={6} forceMount>
        {#snippet child({ wrapperProps, props, open })}
          {#if open}
            <div {...wrapperProps}>
              <div
                {...props}
                transition:uiFade
                class="z-50 rounded-xs bg-surface-container-highest px-2 py-1 text-body-sm
                  text-on-surface-variant shadow-e1"
              >
                {label}
              </div>
            </div>
          {/if}
        {/snippet}
      </Tooltip.Content>
    </Tooltip.Portal>
  </Tooltip.Root>
</Tooltip.Provider>
