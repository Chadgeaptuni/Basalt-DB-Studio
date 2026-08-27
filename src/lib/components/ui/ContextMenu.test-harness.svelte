<script lang="ts">
  import ContextMenu from "./ContextMenu.svelte";
  import type { MenuItem, MenuItems } from "./menu";

  interface Props {
    onselect: (label: string) => void;
    /** Renders the same two rows as two sections, to cover the grouped shape. */
    grouped?: boolean;
  }

  let { onselect, grouped = false }: Props = $props();

  const open: MenuItem = { label: "Open", onselect: () => onselect("Open") };
  const del: MenuItem = { label: "Delete", danger: true, onselect: () => onselect("Delete") };
  const items: MenuItems = $derived(grouped ? [[open], [del]] : [open, del]);
</script>

<ContextMenu {items}>
  <button type="button">Query row</button>
</ContextMenu>
