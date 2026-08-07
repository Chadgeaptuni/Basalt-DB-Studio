<script lang="ts">
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";
  import type { Snippet } from "svelte";
  import { presentError } from "$lib/utils/errorPresentation";
  import type { ErrorKind } from "$lib/api/types";

  // The one error rendering (DESIGN §8): kind-specific headline, the next step,
  // then the backend's own words in mono. Before U6 this markup was written out
  // at eight call sites, three of which showed the raw message with no heading
  // and no action — which is the "generic error" the design bans.
  //
  // `kind` is a plain string prop, not an ApiError: ui/ may not know about the
  // api layer (DESIGN §9), and the caller already holds the error.
  interface Props {
    kind: ErrorKind;
    /** The backend's message. Rendered verbatim under the hint. */
    message?: string;
    /** Dense form for toolbars and list rows; `block` fills a pane. */
    size?: "block" | "inline";
    /** Tint the whole strip as an error container — for a failed row in a list. */
    filled?: boolean;
    /** The recovery action, e.g. [Retry]. Trailing on `inline`, below on `block`. */
    action?: Snippet;
  }

  let { kind, message, size = "block", filled = false, action }: Props = $props();

  const seen = $derived(presentError(kind));
  const block = $derived(size === "block");
</script>

<div
  class="flex items-start gap-2 {block ? 'p-3' : 'px-3 py-1.5'}
    {filled ? 'bg-error-container text-on-error-container' : 'text-on-surface'}"
  role="alert"
>
  <TriangleAlert
    size={block ? 16 : 13}
    strokeWidth={2}
    class="mt-0.5 shrink-0 {filled ? '' : 'text-error'}"
  />

  <div class="flex min-w-0 flex-1 flex-col gap-0.5">
    <span class="{block ? 'text-body-md' : 'text-body-sm'} font-medium">{seen.title}</span>
    <span class="text-body-sm {filled ? 'opacity-90' : 'text-on-surface-variant'}">{seen.hint}</span>
    {#if message}
      <span
        class="mt-0.5 text-data break-words whitespace-pre-wrap
          {filled ? 'opacity-90' : 'text-on-surface-muted'}"
      >
        {message}
      </span>
    {/if}
    {#if action && block}
      <div class="mt-2">{@render action()}</div>
    {/if}
  </div>

  {#if action && !block}
    <div class="shrink-0">{@render action()}</div>
  {/if}
</div>
