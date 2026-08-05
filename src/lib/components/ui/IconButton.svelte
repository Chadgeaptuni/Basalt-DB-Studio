<script lang="ts">
  import type { IconComponent } from "./icon";
  import Spinner from "./Spinner.svelte";
  import { stateLayer, focusRing } from "./stateLayer";

  interface Props {
    icon: IconComponent;
    /** Required — doubles as tooltip and aria-label (DESIGN §6). */
    title: string;
    size?: "sm" | "md";
    disabled?: boolean;
    /** Set only for toggle buttons; omitted for ordinary actions. */
    active?: boolean;
    /** Shows a spinner in place of the icon and blocks clicks while pending. */
    loading?: boolean;
    onclick?: (e: MouseEvent) => void;
  }

  let {
    icon: Icon,
    title,
    size = "md",
    disabled = false,
    active,
    loading = false,
    onclick,
  }: Props = $props();

  // M3 icon buttons are circular; 32/40px are the dense and standard targets.
  const box = $derived(size === "sm" ? "h-8 w-8" : "h-10 w-10");
  const px = $derived(size === "sm" ? 16 : 20);
</script>

<button
  type="button"
  {title}
  aria-label={title}
  aria-pressed={active}
  disabled={disabled || loading}
  {onclick}
  class="grid place-items-center rounded-full {box} {stateLayer} {focusRing}
    {active === true
    ? 'bg-secondary-container text-on-secondary-container'
    : 'text-on-surface-variant'}"
>
  {#if loading}
    <Spinner size="sm" />
  {:else}
    <Icon size={px} strokeWidth={2} />
  {/if}
</button>
