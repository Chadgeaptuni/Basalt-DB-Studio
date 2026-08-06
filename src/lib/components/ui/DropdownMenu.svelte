<script lang="ts">
  import type { Snippet } from "svelte";
  import { DropdownMenu as DropdownMenuPrimitive } from "bits-ui";
  import MenuRow from "./MenuRow.svelte";
  import { MENU_SURFACE, menuRowClass, type MenuItem } from "./menu";

  // Click-anchored menu — the data grid's column headers, and anywhere else a
  // control opens a list of choices. Same surface and rows as `ContextMenu`;
  // only the anchor differs (DESIGN §6).
  interface Props {
    items: MenuItem[];
    /** Accessible name for the trigger, which is usually icon-only. */
    label: string;
    align?: "start" | "center" | "end";
    triggerClass?: string;
    children: Snippet;
  }

  let { items, label, align = "start", triggerClass = "", children }: Props = $props();
</script>

<DropdownMenuPrimitive.Root>
  <DropdownMenuPrimitive.Trigger aria-label={label} class={triggerClass}>
    {@render children()}
  </DropdownMenuPrimitive.Trigger>

  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content loop {align} sideOffset={4} class={MENU_SURFACE}>
      {#each items as item (item.label)}
        <DropdownMenuPrimitive.Item
          onSelect={item.onselect}
          disabled={item.disabled}
          class={menuRowClass(item)}
        >
          <MenuRow {item} />
        </DropdownMenuPrimitive.Item>
      {/each}
    </DropdownMenuPrimitive.Content>
  </DropdownMenuPrimitive.Portal>
</DropdownMenuPrimitive.Root>
