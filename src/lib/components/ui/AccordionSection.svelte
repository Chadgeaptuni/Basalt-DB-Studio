<script lang="ts">
  // One collapsible, resizable sidebar section (VSCode-style accordion). Used
  // *inside* each panel so the panel keeps its own action buttons (via the `actions`
  // snippet). Open/collapse + weight live in the sidebar store (DESIGN §9).
  //   - open/close animates via `grid-template-rows` (CSS only, so app.css's
  //     prefers-reduced-motion rule covers it).
  //   - the bottom drag handle transfers flex weight with the next open section.
  import type { Snippet } from "svelte";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import { sidebar, SECTIONS, type SectionId } from "$lib/stores/sidebar.svelte";
  import { zoom } from "$lib/stores/zoom.svelte";

  interface Props {
    id: SectionId;
    title: string;
    actions?: Snippet;
    children: Snippet;
  }
  let { id, title, actions, children }: Props = $props();

  const open = $derived(sidebar.isOpen(id));
  const openIds = $derived(SECTIONS.filter((s) => sidebar.isOpen(s.id)).map((s) => s.id));
  // The open section directly below this one — the drag handle resizes against it.
  const below = $derived<SectionId | undefined>(openIds[openIds.indexOf(id) + 1]);

  let lastY = 0;
  function startResize(e: PointerEvent): void {
    e.preventDefault();
    e.stopPropagation();
    lastY = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onResize(e: PointerEvent): void {
    if (!(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId) || !below) return;
    // Pointer is viewport px; divide by zoom (sidebar lives in the zoomed #app space).
    sidebar.resizeSections(id, below, (e.clientY - lastY) / zoom.level);
    lastY = e.clientY;
  }
  function endResize(e: PointerEvent): void {
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* pointer already released */
    }
  }
</script>

<section
  class="relative flex flex-col border-b border-border {open ? 'min-h-0' : 'shrink-0'}"
  style={open ? `flex:${sidebar.size(id)} 1 0` : ""}
>
  <header class="flex h-9 shrink-0 items-center gap-2 px-3 {open ? 'border-b border-border' : ''}">
    <button
      type="button"
      onclick={() => sidebar.toggle(id)}
      aria-expanded={open}
      class="flex min-w-0 flex-1 items-center gap-1.5 text-left text-fg-2 transition-colors
        hover:text-fg-1"
    >
      {#if open}
        <ChevronDown size={13} class="shrink-0" />
      {:else}
        <ChevronRight size={13} class="shrink-0" />
      {/if}
      <span class="truncate text-xs font-medium tracking-wider uppercase">{title}</span>
    </button>
    {#if actions}
      <div class="flex shrink-0 items-center gap-1">{@render actions()}</div>
    {/if}
  </header>

  <!-- grid 1fr↔0fr = the open/close animation; inner clips while it runs. -->
  <div
    class="grid min-h-0 transition-[grid-template-rows] duration-150
      {open ? 'flex-1 grid-rows-[1fr]' : 'grid-rows-[0fr]'}"
  >
    <div class="flex min-h-0 flex-col overflow-hidden">{@render children()}</div>
  </div>

  {#if open && below}
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize section"
      onpointerdown={startResize}
      onpointermove={onResize}
      onpointerup={endResize}
      class="absolute inset-x-0 -bottom-0.5 z-10 h-1 cursor-row-resize hover:bg-accent/40"
    ></div>
  {/if}
</section>
