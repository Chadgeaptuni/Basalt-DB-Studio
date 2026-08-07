<script lang="ts">
  import type { HTMLButtonAttributes } from "svelte/elements";
  import type { IconComponent } from "$lib/components/ui/icon";
  import { focusRing, stateLayerGroup } from "$lib/components/ui/stateLayer";

  // One 56px rail block: a 56×32 pill holding the icon, label underneath
  // (DESIGN §6). Extracted so the rail's destinations and the actions below them
  // are the same object — the settings block is not a tab, but it has no business
  // looking like a different kind of thing.
  //
  // Everything ARIA is passed through: a destination arrives carrying
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

<button
  type="button"
  title={label}
  {...rest}
  class="group flex h-14 w-full shrink-0 flex-col items-center justify-center gap-1
    text-label-sm {focusRing} {active ? 'text-on-surface' : 'text-on-surface-variant'}"
>
  <!-- The indicator is the pill, not the icon colour: M3 marks the active
       destination with a filled 56×32 container so it reads without relying on
       colour alone. -->
  <span
    class="grid h-8 w-14 place-items-center rounded-full transition-colors duration-200
      ease-standard {active
      ? 'bg-secondary-container text-on-secondary-container'
      : stateLayerGroup}"
  >
    <Icon size={18} strokeWidth={2} />
  </span>
  {label}
</button>
