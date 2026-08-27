<script lang="ts">
  import type { Snippet } from "svelte";
  import { ContextMenu as ContextMenuPrimitive } from "bits-ui";
  import MenuRow from "./MenuRow.svelte";
  import { MENU_SEPARATOR, MENU_SURFACE, menuRowClass, menuSections, type MenuItems } from "./menu";
  import { popIn, popOut } from "$lib/utils/motion";

  // Right-click menu. Surface, row metrics and row content come from `menu.ts` /
  // `MenuRow`, shared with `DropdownMenu` (DESIGN §6).
  interface Props {
    items: MenuItems;
    children: Snippet;
  }

  let { items, children }: Props = $props();

  const sections = $derived(menuSections(items));
</script>

<ContextMenuPrimitive.Root>
  <ContextMenuPrimitive.Trigger class="contents">
    {@render children()}
  </ContextMenuPrimitive.Trigger>

  <ContextMenuPrimitive.Portal>
    <!-- `forceMount` + `child` is what lets a transition run at all: without it
         bits-ui unmounts the content the instant it closes, so there is no exit
         to animate. The class and the transition go on the inner element, never
         on `wrapperProps` — that one carries the positioning transform, and a
         scale there would fight it. -->
    <ContextMenuPrimitive.Content loop sideOffset={2} forceMount>
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
                  <ContextMenuPrimitive.Item
                    onSelect={item.onselect}
                    disabled={item.disabled}
                    class={menuRowClass(item)}
                  >
                    <MenuRow {item} />
                  </ContextMenuPrimitive.Item>
                {/each}
              {/each}
            </div>
          </div>
        {/if}
      {/snippet}
    </ContextMenuPrimitive.Content>
  </ContextMenuPrimitive.Portal>
</ContextMenuPrimitive.Root>
