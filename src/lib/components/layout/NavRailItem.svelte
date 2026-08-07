<script lang="ts">
  import type { HTMLButtonAttributes } from "svelte/elements";
  import type { IconComponent } from "$lib/components/ui/icon";
  import Tooltip from "$lib/components/ui/Tooltip.svelte";
  import { focusRing, stateLayerGroup } from "$lib/components/ui/stateLayer";

  // One rail block: a 48×32 pill holding the icon, and nothing else. The label
  // shows on hover, to the side, through the shared `Tooltip` — four words of
  // permanent chrome under each icon is a lot of column to spend on names the
  // user learns in a day.
  //
  // The name is not lost when the text goes: it moves to `aria-label`, which is
  // what assistive tech reads either way. The tooltip is decoration on top of it.
  //
  // The *active* destination shows no tooltip. Its panel is open right beside the
  // icon with the same word in its header, so the tooltip is a label for
  // something already labelled — and it lands on top of the panel it just opened.
  //
  // Extracted so the rail's destinations and the actions below them are the same
  // object. Everything ARIA is passed through: a destination arrives carrying
  // `role="tab"`, `aria-selected` and roving `tabindex`; an action arrives as a
  // plain button. This component takes no view on which it is.
  interface Props extends HTMLButtonAttributes {
    icon: IconComponent;
    label: string;
    /** Draws the M3 active-destination pill. Actions never set it. */
    active?: boolean;
  }

  let { icon: Icon, label, active = false, ...rest }: Props = $props();
</script>

<Tooltip {label} side="right" suppressed={active}>
  {#snippet children(tooltipProps)}
    <button
      {...tooltipProps}
      type="button"
      aria-label={label}
      {...rest}
      class="group grid h-10 w-full shrink-0 place-items-center {focusRing}
        {active ? 'text-on-surface' : 'text-on-surface-variant'}"
    >
      <!-- The indicator is the pill, not the icon colour: M3 marks the active
           destination with a filled container so it reads without relying on
           colour alone. 48×32 rather than the spec's 56×32, to the same ratio as
           the narrowed rail around it. -->
      <span
        class="grid h-8 w-12 place-items-center rounded-full transition-colors duration-200
          ease-standard {active
          ? 'bg-secondary-container text-on-secondary-container'
          : stateLayerGroup}"
      >
        <Icon size={20} strokeWidth={2} />
      </span>
    </button>
  {/snippet}
</Tooltip>
