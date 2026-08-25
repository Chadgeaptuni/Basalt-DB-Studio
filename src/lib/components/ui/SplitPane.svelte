<script lang="ts">
  import type { Snippet } from "svelte";
  import ResizeHandle from "./ResizeHandle.svelte";

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
  const isH = $derived(direction === "horizontal");

  /** The container's extent along the split axis, 0 when it isn't laid out yet. */
  function size(): number {
    if (!container) return 0;
    const rect = container.getBoundingClientRect();
    return isH ? rect.width : rect.height;
  }

  /** Percent, so the handle's ARIA value and its key steps share one unit. */
  function toPercent(clientPos: number): number {
    if (!container) return ratio * 100;
    const rect = container.getBoundingClientRect();
    const extent = size();
    if (extent <= 0) return ratio * 100;
    return (((isH ? clientPos - rect.left : clientPos - rect.top) / extent) * 100);
  }

  /** `min` is in px, so the usable percent range depends on the current size —
   *  which is why Home/End clamp here rather than through the handle's bounds. */
  function setPercent(pct: number): void {
    const extent = size();
    if (extent <= 0) return;
    const floor = Math.min(50, (min / extent) * 100);
    ratio = Math.min(100 - floor, Math.max(floor, pct)) / 100;
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
  <!-- A 1px line, so `grab` widens the hit area to ±4px. `ResizeHandle` owns the
       hairline's resting and accent colours. -->
  <ResizeHandle
    orientation={isH ? "vertical" : "horizontal"}
    value={ratio * 100}
    min={0}
    max={100}
    step={2}
    {label}
    toValue={toPercent}
    onchange={setPercent}
    grab
    class="relative shrink-0 {isH ? 'w-px' : 'h-px'}"
  />
  <div class="flex-1 overflow-hidden {isH ? 'h-full' : 'w-full'}">
    {@render b()}
  </div>
</div>
