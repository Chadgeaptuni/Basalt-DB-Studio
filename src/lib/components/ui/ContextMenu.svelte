<script lang="ts" module>
  export interface MenuItem {
    label: string;
    danger?: boolean;
    onselect: () => void;
  }
</script>

<script lang="ts">
  // Floating menu at (x,y): `--bg-2`, 1px border, 24px rows (DESIGN §6). Closes on
  // outside click / Escape. Dumb primitive — the caller owns the items + placement.
  import { uiScale } from "$lib/utils/motion";

  interface Props {
    x: number;
    y: number;
    items: MenuItem[];
    onclose: () => void;
  }
  let { x, y, items, onclose }: Props = $props();

  $effect(() => {
    const onDocClick = (): void => onclose();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onclose();
    };
    window.addEventListener("click", onDocClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", onDocClick);
      window.removeEventListener("keydown", onKey);
    };
  });
</script>

<!-- Inside clicks are stopped so only outside clicks reach the window closer. -->
<div
  role="menu"
  tabindex="-1"
  class="fixed z-50 min-w-44 rounded-lg border border-border bg-bg-2 py-1"
  style="left:{x}px; top:{y}px; transform-origin:top left"
  onclick={(e) => e.stopPropagation()}
  onkeydown={() => {}}
  transition:uiScale
>
  {#each items as item (item.label)}
    <button
      type="button"
      role="menuitem"
      class="flex h-6 w-full items-center px-3 text-left font-mono text-xs transition-colors
        duration-150 hover:bg-bg-0 {item.danger ? 'text-danger' : 'text-fg-1'}"
      onclick={() => {
        item.onselect();
        onclose();
      }}
    >
      {item.label}
    </button>
  {/each}
</div>
