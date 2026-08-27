<script lang="ts">
  import type { Snippet } from "svelte";
  import { DropdownMenu as DropdownMenuPrimitive } from "bits-ui";
  import MenuRow from "./MenuRow.svelte";
  import { MENU_SEPARATOR, MENU_SURFACE, menuRowClass, menuSections, type MenuItems } from "./menu";
  import { popIn, popOut } from "$lib/utils/motion";

  // Click-anchored menu — the data grid's column headers, and anywhere else a
  // control opens a list of choices. Same surface and rows as `ContextMenu`;
  // only the anchor differs (DESIGN §6).
  interface Props {
    items: MenuItems;
    /** Accessible name for the trigger, which is usually icon-only. */
    label: string;
    align?: "start" | "center" | "end";
    triggerClass?: string;
    children: Snippet;
  }

  let { items, label, align = "start", triggerClass = "", children }: Props = $props();

  const sections = $derived(menuSections(items));
</script>

<DropdownMenuPrimitive.Root>
  <DropdownMenuPrimitive.Trigger aria-label={label} class={triggerClass}>
    {@render children()}
  </DropdownMenuPrimitive.Trigger>

  <DropdownMenuPrimitive.Portal>
    <!-- See `ContextMenu` for why this is `forceMount` + `child`. -->
    <DropdownMenuPrimitive.Content loop {align} sideOffset={4} forceMount>
      {#snippet child({ wrapperProps, props, open })}
        {#if open}
          <div {...wrapperProps}>
            <div {...props} class={MENU_SURFACE} in:popIn out:popOut>
              {#each sections as section, i (i)}
                <!-- A plain rule, not bits-ui's `Separator`: that component renders
                     `role="group"`, so every divider would announce itself to a
                     screen reader as a third, empty group of choices. -->
                {#if i > 0}
                  <div role="separator" aria-orientation="horizontal" class={MENU_SEPARATOR}></div>
                {/if}
                {#each section as item (item.label)}
                  <DropdownMenuPrimitive.Item
                    onSelect={item.onselect}
                    disabled={item.disabled}
                    class={menuRowClass(item)}
                  >
                    <MenuRow {item} />
                  </DropdownMenuPrimitive.Item>
                {/each}
              {/each}
            </div>
          </div>
        {/if}
      {/snippet}
    </DropdownMenuPrimitive.Content>
  </DropdownMenuPrimitive.Portal>
</DropdownMenuPrimitive.Root>
