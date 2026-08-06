<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import Kbd from "./Kbd.svelte";
  import type { MenuItem } from "./menu";

  // The inside of a menu row, so every menu draws icon · label · shortcut the same
  // way. The row *element* belongs to the caller's menu primitive (it needs to be
  // bits-ui's own Item to get selection and typeahead); this is only its content.
  interface Props {
    item: MenuItem;
  }
  let { item }: Props = $props();
</script>

{#if item.checked !== undefined}
  <!-- Fixed slot whether or not this row is the current value, so labels align. -->
  <span class="grid w-4 shrink-0 place-items-center">
    {#if item.checked}<Check size={14} strokeWidth={2} class="text-primary" />{/if}
  </span>
{:else if item.icon}
  <item.icon size={16} strokeWidth={2} class="shrink-0 text-on-surface-muted" />
{/if}

<span class="min-w-0 flex-1 truncate">{item.label}</span>

{#if item.combo}
  <span class="shrink-0"><Kbd combo={item.combo} /></span>
{/if}
