<script lang="ts">
  import type { Snippet } from "svelte";
  import { ContextMenu as ContextMenuPrimitive } from "bits-ui";
  import MenuRow from "./MenuRow.svelte";
  import { MENU_SURFACE, menuRowClass, type MenuItem } from "./menu";

  // Right-click menu. Surface, row metrics and row content come from `menu.ts` /
  // `MenuRow`, shared with `DropdownMenu` (DESIGN §6).
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
    <ContextMenuPrimitive.Content loop sideOffset={2} class={MENU_SURFACE}>
      {#each items as item (item.label)}
        <ContextMenuPrimitive.Item
          onSelect={item.onselect}
          disabled={item.disabled}
          class={menuRowClass(item)}
        >
          <MenuRow {item} />
        </ContextMenuPrimitive.Item>
      {/each}
    </ContextMenuPrimitive.Content>
  </ContextMenuPrimitive.Portal>
</ContextMenuPrimitive.Root>
