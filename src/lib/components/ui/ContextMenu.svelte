<script lang="ts">
  import type { Snippet } from "svelte";
  import { ContextMenu as ContextMenuPrimitive } from "bits-ui";
  import MenuRow from "./MenuRow.svelte";
  import { MENU_SURFACE, menuRowClass, type MenuItem } from "./menu";
  import { popIn, popOut } from "$lib/utils/motion";

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
              {#each items as item (item.label)}
                <ContextMenuPrimitive.Item
                  onSelect={item.onselect}
                  disabled={item.disabled}
                  class={menuRowClass(item)}
                >
                  <MenuRow {item} />
                </ContextMenuPrimitive.Item>
              {/each}
            </div>
          </div>
        {/if}
      {/snippet}
    </ContextMenuPrimitive.Content>
  </ContextMenuPrimitive.Portal>
</ContextMenuPrimitive.Root>
