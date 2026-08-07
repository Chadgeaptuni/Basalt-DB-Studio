<script lang="ts">
  import type { Snippet } from "svelte";

  // One setting: what it is on the left, the control that changes it on the
  // right. Rows rather than the grid of bordered cards this replaced — a card is
  // for a self-contained object, and a single dropdown with a caption is not one
  // (DESIGN §5). Two of them side by side also made each setting look like a
  // choice *between* the two, and the pair went ragged as soon as one caption ran
  // to a second line.
  //
  // Down a column instead, every label starts at the same x and every control
  // ends at the same one, so the list scans in one pass and a new setting is one
  // more row rather than a relayout.
  interface Props {
    label: string;
    /** What the setting actually affects — the consequence, not a restatement. */
    hint?: string;
    /**
     * Receives the row's own label text. The control is a sibling of the label,
     * not inside it, so it cannot inherit the name — passing it down is what
     * stops the two drifting when one gets reworded.
     */
    control: Snippet<[string]>;
  }
  let { label, hint, control }: Props = $props();
</script>

<!-- `items-start`, not `items-center`: the control lines up with the label, and
     stays there when the hint wraps to a second line. -->
<div class="flex items-start justify-between gap-6 px-4 py-3">
  <div class="min-w-0 pt-1">
    <p class="text-label-md text-on-surface">{label}</p>
    {#if hint}<p class="text-body-sm text-on-surface-muted">{hint}</p>{/if}
  </div>
  <div class="w-56 shrink-0">{@render control(label)}</div>
</div>
