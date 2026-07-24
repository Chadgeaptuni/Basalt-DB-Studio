<script lang="ts">
  import type { IconComponent } from "./icon";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";

  interface Props {
    label: string;
    depth?: number;
    icon?: IconComponent;
    expandable?: boolean;
    expanded?: boolean;
    selected?: boolean;
    title?: string;
    onclick?: () => void;
    ontoggle?: () => void;
  }

  let {
    label,
    depth = 0,
    icon: Icon,
    expandable = false,
    expanded = false,
    selected = false,
    title,
    onclick,
    ontoggle,
  }: Props = $props();
</script>

<div
  role="treeitem"
  tabindex="0"
  aria-expanded={expandable ? expanded : undefined}
  aria-selected={selected}
  {title}
  class="flex h-6 cursor-pointer items-center gap-1 pr-2 font-mono text-xs transition-colors
    duration-150 {selected ? 'bg-bg-2 text-fg-0' : 'text-fg-1 hover:bg-bg-2'}"
  style="padding-left:{depth * 12 + 4}px"
  onclick={() => onclick?.()}
  onkeydown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onclick?.();
    }
  }}
>
  {#if expandable}
    <button
      type="button"
      tabindex="-1"
      aria-label={expanded ? "Collapse" : "Expand"}
      class="flex h-4 w-4 shrink-0 items-center justify-center text-fg-2"
      onclick={(e) => {
        e.stopPropagation();
        ontoggle?.();
      }}
    >
      {#if expanded}<ChevronDown size={12} />{:else}<ChevronRight size={12} />{/if}
    </button>
  {:else}
    <span class="w-4 shrink-0"></span>
  {/if}
  {#if Icon}<Icon size={13} strokeWidth={2} class="shrink-0 text-fg-2" />{/if}
  <span class="truncate">{label}</span>
</div>
