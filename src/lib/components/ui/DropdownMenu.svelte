<script lang="ts">
  import type { Snippet } from "svelte";
  import { DropdownMenu as DropdownMenuPrimitive } from "bits-ui";
  import MenuRow from "./MenuRow.svelte";
  import { MENU_SURFACE, menuRowClass, type MenuItem } from "./menu";
  import { popIn, popOut } from "$lib/utils/motion";

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
    <!-- See `ContextMenu` for why this is `forceMount` + `child`. -->
    <DropdownMenuPrimitive.Content loop {align} sideOffset={4} forceMount>
      {#snippet child({ wrapperProps, props, open })}
        {#if open}
          <div {...wrapperProps}>
            <div {...props} class={MENU_SURFACE} in:popIn out:popOut>
              {#each items as item (item.label)}
                <DropdownMenuPrimitive.Item
                  onSelect={item.onselect}
                  disabled={item.disabled}
                  class={menuRowClass(item)}
                >
                  <MenuRow {item} />
                </DropdownMenuPrimitive.Item>
              {/each}
            </div>
          </div>
        {/if}
      {/snippet}
    </DropdownMenuPrimitive.Content>
  </DropdownMenuPrimitive.Portal>
</DropdownMenuPrimitive.Root>
