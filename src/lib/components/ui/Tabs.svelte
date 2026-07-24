<script lang="ts" module>
  export interface TabItem {
    id: string;
    label: string;
    closable?: boolean;
    /** Colors the label — e.g. a failing statement's result tab. */
    tone?: "default" | "danger" | "ok";
  }
</script>

<script lang="ts">
  import X from "@lucide/svelte/icons/x";
  import type { Snippet } from "svelte";

  // Shared horizontal tab strip (DESIGN §6). Used for editor tabs and per-statement
  // result tabs. Dumb primitive: selection/close are callback props.
  interface Props {
    items: TabItem[];
    activeId: string | null;
    onSelect: (id: string) => void;
    onClose?: (id: string) => void;
    /** Optional trailing controls (e.g. a "+" new-tab button). */
    trailing?: Snippet;
  }
  let { items, activeId, onSelect, onClose, trailing }: Props = $props();

  const tone: Record<NonNullable<TabItem["tone"]>, string> = {
    default: "",
    danger: "text-danger",
    ok: "text-ok",
  };
</script>

<div role="tablist" class="flex h-8 items-stretch overflow-x-auto border-b border-border bg-bg-1">
  {#each items as item (item.id)}
    <div
      role="tab"
      tabindex="0"
      aria-selected={item.id === activeId}
      class="group flex h-full cursor-pointer items-center gap-1.5 border-r border-border px-3
        font-mono text-xs whitespace-nowrap transition-colors duration-150
        {item.id === activeId ? 'bg-bg-0 text-fg-0' : 'text-fg-2 hover:bg-bg-2 hover:text-fg-1'}"
      onclick={() => onSelect(item.id)}
      onkeydown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(item.id);
        }
      }}
    >
      <span class={tone[item.tone ?? "default"]}>{item.label}</span>
      {#if item.closable && onClose}
        <button
          type="button"
          tabindex="-1"
          aria-label="Close tab"
          class="flex h-4 w-4 items-center justify-center rounded text-fg-2 opacity-0
            transition-opacity hover:bg-bg-2 hover:text-fg-0 group-hover:opacity-100"
          onclick={(e) => {
            e.stopPropagation();
            onClose?.(item.id);
          }}
        >
          <X size={11} />
        </button>
      {/if}
    </div>
  {/each}
  {#if trailing}
    <div class="flex items-center px-1">{@render trailing()}</div>
  {/if}
</div>
