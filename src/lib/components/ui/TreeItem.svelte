<script lang="ts">
  import type { IconComponent } from "./icon";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import { stateLayerPill, focusRing } from "./stateLayer";

  interface Props {
    label: string;
    depth?: number;
    icon?: IconComponent;
    /** Role token for the icon — a tree root whose subject has a live status
     *  (a connection) colours the glyph; everything else stays muted. */
    iconClass?: string;
    expandable?: boolean;
    expanded?: boolean;
    selected?: boolean;
    title?: string;
    onclick?: () => void;
    ondblclick?: () => void;
    oncontextmenu?: (e: MouseEvent) => void;
    ontoggle?: () => void;
  }

  let {
    label,
    depth = 0,
    icon: Icon,
    iconClass = "text-on-surface-muted",
    expandable = false,
    expanded = false,
    selected = false,
    title,
    onclick,
    ondblclick,
    oncontextmenu,
    ontoggle,
  }: Props = $props();
</script>

<div
  role="treeitem"
  tabindex="0"
  aria-expanded={expandable ? expanded : undefined}
  aria-selected={selected}
  {title}
  class="flex h-9 cursor-pointer items-center gap-1.5 pr-3 text-data {stateLayerPill} {focusRing}
    {selected ? 'text-on-surface' : 'text-on-surface-variant'}"
  style="padding-left:{depth * 12 + 8}px"
  onclick={() => onclick?.()}
  ondblclick={() => ondblclick?.()}
  oncontextmenu={(e) => {
    if (oncontextmenu) {
      e.preventDefault();
      oncontextmenu(e);
    }
  }}
  onkeydown={(e) => {
    // The ARIA tree pattern: arrows expand and collapse, and they are directional
    // rather than a toggle — pressing → on an open node must not close it. The row
    // announces `aria-expanded`, so it owes the keys that go with it.
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onclick?.();
    } else if (expandable && e.key === "ArrowRight" && !expanded) {
      e.preventDefault();
      ontoggle?.();
    } else if (expandable && e.key === "ArrowLeft" && expanded) {
      e.preventDefault();
      ontoggle?.();
    }
  }}
>
  <!-- Fixed 16px leading slot whether or not the row expands, so labels line up
       across depths (DESIGN §6). -->
  {#if expandable}
    <button
      type="button"
      tabindex="-1"
      aria-label={expanded ? "Collapse" : "Expand"}
      class="flex h-4 w-4 shrink-0 items-center justify-center text-on-surface-muted"
      onclick={(e) => {
        e.stopPropagation();
        ontoggle?.();
      }}
    >
      {#if expanded}<ChevronDown size={14} />{:else}<ChevronRight size={14} />{/if}
    </button>
  {:else}
    <span class="w-4 shrink-0"></span>
  {/if}
  {#if Icon}<Icon size={14} strokeWidth={2} class="shrink-0 {iconClass}" />{/if}
  <span class="truncate">{label}</span>
</div>
