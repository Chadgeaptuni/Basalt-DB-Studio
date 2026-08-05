<script lang="ts">
  import type { IconComponent } from "./icon";
  import Spinner from "./Spinner.svelte";

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

  const box = $derived(size === "sm" ? "h-6 w-6" : "h-7 w-7");
  const px = $derived(size === "sm" ? 14 : 16);
</script>

<button
  type="button"
  {title}
  aria-label={title}
  aria-pressed={active}
  disabled={disabled || loading}
  {onclick}
  class="inline-flex items-center justify-center rounded-md {box} transition-colors duration-150
    hover:bg-bg-2 hover:text-fg-0 disabled:opacity-50 disabled:pointer-events-none
    {active === true ? 'bg-bg-2 text-fg-0' : 'text-fg-1'}"
>
  {#if loading}
    <Spinner size="sm" />
  {:else}
    <Icon size={px} strokeWidth={2} />
  {/if}
</button>
