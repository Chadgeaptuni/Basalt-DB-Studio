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
  import { uiSlide } from "$lib/utils/motion";

  // Shared horizontal tab strip (DESIGN §6). Used for editor tabs and per-statement
  // result tabs. Dumb primitive: selection/close are callback props.
  interface Props {
    items: TabItem[];
    activeId: string | null;
    onSelect: (id: string) => void;
    onClose?: (id: string) => void;
    label?: string;
    /** Optional trailing controls (e.g. a "+" new-tab button). */
    trailing?: Snippet;
  }
  let { items, activeId, onSelect, onClose, label = "Tabs", trailing }: Props = $props();

  let tablist = $state<HTMLElement>();

  const tone: Record<NonNullable<TabItem["tone"]>, string> = {
    default: "",
    danger: "text-danger",
    ok: "text-ok",
  };

  function onKeydown(e: KeyboardEvent): void {
    if (!(e.target instanceof HTMLElement) || e.target.getAttribute("role") !== "tab" || !tablist) return;
    const tabs = [...tablist.querySelectorAll<HTMLElement>('[role="tab"]')];
    const current = tabs.indexOf(e.target);
    let next: number | undefined;
    if (e.key === "ArrowRight") next = (current + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (current - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next === undefined) return;
    e.preventDefault();
    tabs[next].focus();
    onSelect(items[next].id);
  }
</script>

<div
  bind:this={tablist}
  role="tablist"
  aria-label={label}
  class="flex h-8 items-stretch overflow-x-auto border-b border-border bg-bg-1"
>
  {#each items as item (item.id)}
    <div
      transition:uiSlide={{ axis: "x" }}
      class="group flex h-full items-center border-r border-border font-mono text-xs whitespace-nowrap
        transition-colors duration-150
        {item.id === activeId ? 'bg-bg-0 text-fg-0' : 'text-fg-2 hover:bg-bg-2 hover:text-fg-1'}"
    >
      <button
        type="button"
        role="tab"
        tabindex={item.id === activeId ? 0 : -1}
        aria-selected={item.id === activeId}
        class="flex h-full items-center pl-3 {item.closable && onClose ? 'pr-1' : 'pr-3'}"
        onclick={() => onSelect(item.id)}
        onkeydown={onKeydown}
        onmousedown={(e) => {
          if (e.button === 1) e.preventDefault();
        }}
        onauxclick={(e) => {
          if (e.button === 1 && item.closable && onClose) {
            e.preventDefault();
            onClose(item.id);
          }
        }}
      >
        <span class={tone[item.tone ?? "default"]}>{item.label}</span>
      </button>
      {#if item.closable && onClose}
        <button
          type="button"
          aria-label={`Close ${item.label}`}
          class="flex h-4 w-4 items-center justify-center rounded text-fg-2 opacity-0
            transition-opacity hover:bg-bg-2 hover:text-fg-0 group-hover:opacity-100
            group-focus-within:opacity-100"
          onclick={() => onClose?.(item.id)}
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
