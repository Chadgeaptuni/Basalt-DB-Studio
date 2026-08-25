<script lang="ts">
  // The WAI-ARIA window-splitter: a focusable separator that carries a value and
  // moves on both pointer and keyboard.
  //
  // There were two of these — SplitPane's, which had arrow keys, and PanelHost's,
  // which did not, so the side panel could only be resized with a mouse. Rather
  // than copy the key handling into the second one, both now consume this.
  //
  // The parent keeps ownership of what the value *means* (a percentage of a
  // container, a pixel width) and supplies `toValue`; this owns pointer capture,
  // the key map, the ARIA contract, and the hairline's own appearance.
  //
  // Appearance lives here because it did not, and the two callers drifted: the
  // split handle signalled with full `--primary` while the panel edge used
  // `--primary/40`, so the same gesture gave different feedback in each pane.
  // Callers now pass geometry only. A translucent state layer over a 1px line is
  // a no-op, so this is DESIGN §7's documented carve-out — the line recolours
  // outright, and holds the accent while dragging rather than dropping it the
  // moment the pointer leaves the hairline.
  interface Props {
    /** Per ARIA: a `vertical` separator sits between left and right panes. */
    orientation: "vertical" | "horizontal";
    value: number;
    min: number;
    max: number;
    /** Keyboard increment, in the same unit as `value`. */
    step?: number;
    label: string;
    /** Map a pointer's clientX (vertical) or clientY (horizontal) to a value. */
    toValue: (clientPos: number) => number;
    onchange: (next: number) => void;
    /** Render an invisible ±4px expander — for a handle that is itself a hairline. */
    grab?: boolean;
    class?: string;
  }

  let {
    orientation,
    value,
    min,
    max,
    step = 1,
    label,
    toValue,
    onchange,
    grab = false,
    class: cls = "",
  }: Props = $props();

  const vertical = $derived(orientation === "vertical");
  // `$state` because the resting/dragging colour reads it — a plain `let` would
  // set the flag and never repaint.
  let dragging = $state(false);

  function move(next: number): void {
    onchange(Math.min(max, Math.max(min, next)));
  }

  function onPointerDown(e: PointerEvent): void {
    e.preventDefault();
    dragging = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: PointerEvent): void {
    if (dragging) move(toValue(vertical ? e.clientX : e.clientY));
  }
  function onPointerUp(e: PointerEvent): void {
    dragging = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* pointer already released */
    }
  }

  function onKeydown(e: KeyboardEvent): void {
    const back = vertical ? "ArrowLeft" : "ArrowUp";
    const forward = vertical ? "ArrowRight" : "ArrowDown";
    if (e.key === back) move(value - step);
    else if (e.key === forward) move(value + step);
    else if (e.key === "Home") move(min);
    else if (e.key === "End") move(max);
    else return;
    e.preventDefault();
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions (the window-splitter pattern makes a value-bearing separator focusable) -->
<div
  role="separator"
  tabindex="0"
  aria-label={label}
  aria-orientation={orientation}
  aria-valuemin={Math.round(min)}
  aria-valuemax={Math.round(max)}
  aria-valuenow={Math.round(value)}
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
  onpointercancel={onPointerUp}
  onkeydown={onKeydown}
  class="transition-colors duration-200 ease-standard
    {dragging ? 'bg-primary' : 'bg-outline-variant hover:bg-primary'}
    {vertical ? 'cursor-col-resize' : 'cursor-row-resize'} {cls}"
>
  {#if grab}
    <div
      class="absolute {vertical ? 'inset-y-0 -right-1 -left-1' : 'inset-x-0 -top-1 -bottom-1'}"
    ></div>
  {/if}
</div>
