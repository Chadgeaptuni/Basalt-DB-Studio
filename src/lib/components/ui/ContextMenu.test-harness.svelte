<script lang="ts">
  import ContextMenu, { type MenuItem } from "./ContextMenu.svelte";

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
