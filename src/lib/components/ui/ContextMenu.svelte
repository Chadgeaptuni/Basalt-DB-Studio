<script lang="ts" module>
  import type { IconComponent } from "./icon";

  export interface MenuItem {
    label: string;
    icon?: IconComponent;
    danger?: boolean;
    disabled?: boolean;
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
      class="z-50 min-w-44 rounded-md border border-outline-variant
        bg-surface-container-high py-2 shadow-e2 outline-none"
    >
      {#each items as item (item.label)}
        <ContextMenuPrimitive.Item
          onSelect={item.onselect}
          disabled={item.disabled}
          class="flex h-9 cursor-default items-center gap-2 px-3 text-label-md outline-none
            transition-colors duration-200 ease-standard
            data-[highlighted]:bg-surface-container-highest
            data-[disabled]:pointer-events-none data-[disabled]:opacity-[0.38]
            {item.danger ? 'text-error' : 'text-on-surface-variant'}"
        >
          {#if item.icon}
            <item.icon size={16} strokeWidth={2} class="shrink-0 text-on-surface-muted" />
          {/if}
          {item.label}
        </ContextMenuPrimitive.Item>
      {/each}
    </ContextMenuPrimitive.Content>
  </ContextMenuPrimitive.Portal>
</ContextMenuPrimitive.Root>
