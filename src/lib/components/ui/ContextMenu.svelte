<script lang="ts" module>
  export interface MenuItem {
    label: string;
    danger?: boolean;
    onselect: () => void;
  }
</script>

<script lang="ts">
  import type { Snippet } from "svelte";
  import { ContextMenu as ContextMenuPrimitive } from "bits-ui";

  interface Props {
    items: MenuItem[];
    children: Snippet;
  }

  let { items, children }: Props = $props();
</script>

<ContextMenuPrimitive.Root>
  <ContextMenuPrimitive.Trigger class="contents">
    {@render children()}
  </ContextMenuPrimitive.Trigger>

  <ContextMenuPrimitive.Portal>
    <ContextMenuPrimitive.Content
      loop
      sideOffset={2}
      class="z-50 min-w-44 rounded-lg border border-outline-variant bg-surface-container-high py-1 outline-none"
    >
      {#each items as item (item.label)}
        <ContextMenuPrimitive.Item
          onSelect={item.onselect}
          class="flex h-6 cursor-default items-center px-3 font-mono text-xs outline-none
            transition-colors duration-150 data-[highlighted]:bg-surface
            {item.danger ? 'text-danger' : 'text-on-surface-variant'}"
        >
          {item.label}
        </ContextMenuPrimitive.Item>
      {/each}
    </ContextMenuPrimitive.Content>
  </ContextMenuPrimitive.Portal>
</ContextMenuPrimitive.Root>
