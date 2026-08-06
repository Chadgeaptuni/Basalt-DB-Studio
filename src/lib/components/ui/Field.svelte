<script lang="ts">
  import type { Snippet } from "svelte";

  // Label above control, the one form row shape (DESIGN §5). Extracted because the
  // same `<label><span class="text-label-sm tracking-wider …">` block was written
  // out at seventeen call sites across the dialogs — seventeen chances for one of
  // them to drift.
  //
  // It renders a `<label>`, so the control inside is associated without an `id`.
  interface Props {
    label: string;
    /** Supporting text under the control; use for units, formats and constraints. */
    hint?: string;
    children: Snippet;
  }
  let { label, hint, children }: Props = $props();
</script>

<label class="flex min-w-0 flex-col gap-1">
  <span class="text-label-sm tracking-wider text-on-surface-muted uppercase">{label}</span>
  {@render children()}
  {#if hint}
    <span class="text-body-sm text-on-surface-muted">{hint}</span>
  {/if}
</label>
