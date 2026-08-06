<script lang="ts">
  import ContextMenu from "./ContextMenu.svelte";
  import type { MenuItem } from "./menu";

  interface Props {
    onselect: (label: string) => void;
  }

  let { onselect }: Props = $props();

  const items: MenuItem[] = [
    { label: "Open", onselect: () => onselect("Open") },
    { label: "Delete", danger: true, onselect: () => onselect("Delete") },
  ];
</script>

<ContextMenu {items}>
  <button type="button">Query row</button>
</ContextMenu>
