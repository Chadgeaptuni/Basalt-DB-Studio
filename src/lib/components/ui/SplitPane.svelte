<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    direction?: "horizontal" | "vertical";
    /** Initial ratio (0..1) for the first pane. */
    initial?: number;
    /** Minimum px for each pane. */
    min?: number;
    label?: string;
    a: Snippet;
    b: Snippet;
    class?: string;
  }

  let {
    direction = "horizontal",
    initial = 0.5,
    min = 120,
    label = "Resize panes",
    a,
    b,
    class: cls = "",
  }: Props = $props();

  let container = $state<HTMLElement>();
  // svelte-ignore state_referenced_locally
  let ratio = $state(initial);
  let dragging = $state(false);
  const isH = $derived(direction === "horizontal");

  function startDrag(e: PointerEvent): void {
    e.preventDefault();
    dragging = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onMove(e: PointerEvent): void {
    if (!dragging || !container) return;
    const rect = container.getBoundingClientRect();
    const size = isH ? rect.width : rect.height;
    if (size <= 0) return;
    const pos = isH ? e.clientX - rect.left : e.clientY - rect.top;
    const clamped = Math.min(size - min, Math.max(min, pos));
    ratio = clamped / size;
  }

  function setRatio(next: number): void {
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const size = isH ? rect.width : rect.height;
    if (size <= 0) return;
    const minimum = Math.min(0.5, min / size);
    ratio = Math.min(1 - minimum, Math.max(minimum, next));
  }

  function onKeydown(e: KeyboardEvent): void {
    const decrement = isH ? "ArrowLeft" : "ArrowUp";
    const increment = isH ? "ArrowRight" : "ArrowDown";
    if (e.key === decrement) setRatio(ratio - 0.02);
    else if (e.key === increment) setRatio(ratio + 0.02);
    else if (e.key === "Home") setRatio(0);
    else if (e.key === "End") setRatio(1);
    else return;
    e.preventDefault();
  }
  function endDrag(e: PointerEvent): void {
    dragging = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* pointer already released */
    }
  }

  const firstStyle = $derived(isH ? `width:${ratio * 100}%` : `height:${ratio * 100}%`);
</script>

<div
  bind:this={container}
  class="flex h-full w-full {isH ? 'flex-row' : 'flex-col'} {cls}"
>
  <div class="overflow-hidden {isH ? 'h-full' : 'w-full'}" style={firstStyle}>
    {@render a()}
  </div>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions (The WAI-ARIA window-splitter pattern makes a value-bearing separator focusable.) -->
  <div
    role="separator"
    tabindex="0"
    aria-label={label}
    aria-orientation={isH ? "vertical" : "horizontal"}
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={Math.round(ratio * 100)}
    onpointerdown={startDrag}
    onpointermove={onMove}
    onpointerup={endDrag}
    onpointercancel={endDrag}
    onkeydown={onKeydown}
    class="relative shrink-0 bg-border transition-colors hover:bg-accent
      {isH ? 'w-px cursor-col-resize' : 'h-px cursor-row-resize'}"
  >
    <!-- Invisible ±4px grab zone so a 1px line stays easy to hit. -->
    <div class="absolute {isH ? 'inset-y-0 -left-1 -right-1' : 'inset-x-0 -top-1 -bottom-1'}"></div>
  </div>
  <div class="flex-1 overflow-hidden {isH ? 'h-full' : 'w-full'}">
    {@render b()}
  </div>
</div>
