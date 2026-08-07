<script lang="ts">
  import type { GraphRow } from "$lib/utils/commitGraph";
  import { laneCount } from "$lib/utils/commitGraph";

  // The lane gutter beside the commit list: one SVG per row, drawn in the same
  // 36px box the row occupies, so the graph and the text cannot drift apart no
  // matter how the list scrolls or wraps.
  //
  // Deliberately not one tall SVG for the whole history: that version has to
  // re-render entirely on every scroll and cannot live inside a virtualized list.
  // Per-row keeps each drawing to four line segments.
  interface Props {
    row: GraphRow;
    rows: GraphRow[];
    /** Marks the commit the list has selected. */
    selected: boolean;
  }
  let { row, rows, selected }: Props = $props();

  const LANE_W = 14;
  const ROW_H = 36;
  const RADIUS = 3.5;

  const lanes = $derived(laneCount(rows));
  const width = $derived(Math.max(lanes, 1) * LANE_W);
  const x = (lane: number): number => lane * LANE_W + LANE_W / 2;

  // A lane that changes column bends through the middle of the row rather than
  // cutting the corner, which is what makes a merge read as joining rather than
  // as two unrelated strokes that happen to touch.
  function path(from: number, to: number, fromNode: boolean): string {
    const [x1, x2] = [x(from), x(to)];
    const [y1, y2] = fromNode ? [ROW_H / 2, ROW_H] : [0, ROW_H / 2];
    if (x1 === x2) return `M ${x1} ${y1} L ${x1} ${y2}`;
    const mid = (y1 + y2) / 2;
    return `M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`;
  }
</script>

<!-- Decorative: every commit's identity is in the row's text beside it, and a
     screen reader reading out lane geometry would be noise. -->
<svg
  aria-hidden="true"
  width={width}
  height={ROW_H}
  viewBox="0 0 {width} {ROW_H}"
  class="shrink-0 overflow-visible text-outline"
>
  {#each row.edges as edge, i (i)}
    <path
      d={path(edge.from, edge.to, edge.fromNode)}
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
    />
  {/each}

  <!-- A merge gets a hollow node: it introduces no change of its own, and the
       filled dot is reserved for commits that do. -->
  <circle
    cx={x(row.lane)}
    cy={ROW_H / 2}
    r={RADIUS}
    class={selected ? "text-primary" : "text-on-surface-variant"}
    fill={row.commit.parents.length > 1 ? "var(--surface)" : "currentColor"}
    stroke="currentColor"
    stroke-width="1.5"
  />
</svg>
