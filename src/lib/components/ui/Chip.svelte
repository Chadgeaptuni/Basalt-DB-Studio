<script lang="ts" module>
  export type ChipTone = "neutral" | "primary" | "warn" | "error";
</script>

<script lang="ts">
  import type { Snippet } from "svelte";
  import X from "@lucide/svelte/icons/x";
  import type { IconComponent } from "./icon";
  import { stateLayer, focusRing } from "./stateLayer";

  // The M3 chip (DESIGN §6): 32px, pill, tonal fill, interactive and usually
  // removable. Distinct from `Badge` — a badge is a 20px static marker that lives
  // inside a 32px bar, where a chip would fill the bar edge to edge.
  //
  // Its job here is making grid state visible *and* reversible: an active sort or
  // filter shows as a chip you can click off, rather than living invisibly in a
  // dialog you have to reopen to undo.
  interface Props {
    tone?: ChipTone;
    icon?: IconComponent;
    title?: string;
    onclick?: () => void;
    onremove?: () => void;
    /** Accessible name for the remove affordance — "Remove" alone says nothing. */
    removeLabel?: string;
    children: Snippet;
  }

  let { tone = "neutral", icon: Icon, title, onclick, onremove, removeLabel, children }: Props =
    $props();

  // `warn` has no M3 container role of its own, so it takes a hairline rather than
  // an invented container colour.
  const tones: Record<ChipTone, string> = {
    neutral: "bg-secondary-container text-on-secondary-container",
    primary: "bg-primary-container text-on-primary-container",
    warn: "bg-surface-container-high text-warn border border-warn/40",
    error: "bg-error-container text-on-error-container",
  };
</script>

<div class="inline-flex h-8 shrink-0 items-center rounded-full text-label-md {tones[tone]}">
  {#if onclick}
    <button
      type="button"
      {title}
      {onclick}
      class="flex h-full items-center gap-1.5 rounded-full pl-3 {onremove ? 'pr-1.5' : 'pr-3'}
        {stateLayer} {focusRing}"
    >
      {#if Icon}<Icon size={14} strokeWidth={2} class="shrink-0" />{/if}
      {@render children()}
    </button>
  {:else}
    <span
      {title}
      class="flex h-full items-center gap-1.5 pl-3 {onremove ? 'pr-1.5' : 'pr-3'}"
    >
      {#if Icon}<Icon size={14} strokeWidth={2} class="shrink-0" />{/if}
      {@render children()}
    </span>
  {/if}

  {#if onremove}
    <button
      type="button"
      aria-label={removeLabel ?? "Remove"}
      onclick={onremove}
      class="mr-1 grid h-6 w-6 shrink-0 place-items-center rounded-full {stateLayer} {focusRing}"
    >
      <X size={13} strokeWidth={2} />
    </button>
  {/if}
</div>
