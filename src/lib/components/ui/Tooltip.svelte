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
  // The trigger renders through bits-ui's `child` snippet, so this component adds
  // no element of its own: it hands its props to the control and the control
  // spreads them. Wrapping instead would nest that control inside bits-ui's own
  // `<button tabindex="0">` — invalid markup, a second tab stop on every icon
  // button, and impossible to use on anything with a role of its own (a rail
  // destination is a `role="tab"`, and a tab inside a button is not a tab).
  //
  // `Tooltip.Provider` lives here rather than at the app root because bits-ui
  // scopes "only one open at a time" to the provider, and each of these wraps a
  // single control.
  interface Props {
    label: string;
    side?: "top" | "bottom" | "left" | "right";
    /**
     * Stop the tooltip opening at all, without unmounting the control. For a
     * label that has stopped being news — the rail's open destination already
     * names itself in the panel header beside it.
     *
     * Suppressed rather than conditionally wrapped: swapping the control in and
     * out of `Tooltip` recreates its DOM node, so activating a rail destination
     * from the keyboard would drop focus and the arrow keys would stop working.
     */
    suppressed?: boolean;
    /** Receives the props the control must spread onto its own element. */
    children: Snippet<[Record<string, unknown>]>;
  }
  let { label, side = "bottom", suppressed = false, children }: Props = $props();
</script>

<Tooltip.Provider delayDuration={400}>
  <!-- `ignoreNonKeyboardFocus`: a mouse click leaves focus on the control, and
       without this the tooltip re-opens from that focus the instant it closes —
       so it flashes back up over whatever the click just did. Tabbing to the
       control still shows it, which is the case that needs it. -->
  <Tooltip.Root disabled={suppressed} ignoreNonKeyboardFocus>
    <Tooltip.Trigger>
      {#snippet child({ props })}
        {@render children(props)}
      {/snippet}
    </Tooltip.Trigger>
    <Tooltip.Portal>
      <Tooltip.Content {side} sideOffset={6} forceMount>
        {#snippet child({ wrapperProps, props, open })}
          {#if open}
            <div {...wrapperProps}>
              <div
                {...props}
                transition:uiFade
                class="app-zoom z-50 rounded-xs bg-surface-container-highest px-2 py-1
                  text-body-sm text-on-surface-variant shadow-e1"
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
