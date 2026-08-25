<script lang="ts">
  import type { IconComponent } from "./icon";
  import Spinner from "./Spinner.svelte";
  import Tooltip from "./Tooltip.svelte";
  import { stateLayer, focusRing } from "./stateLayer";

  interface Props {
    icon: IconComponent;
    /** Required — renders as the tooltip and as `aria-label` (DESIGN §6). */
    title: string;
    size?: "sm" | "md";
    disabled?: boolean;
    /** Set only for toggle buttons; omitted for ordinary actions. */
    active?: boolean;
    /** `danger` reddens on hover — for an action that discards or closes. */
    tone?: "default" | "danger";
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
    tone = "default",
    loading = false,
    onclick,
  }: Props = $props();

  // M3 icon buttons are circular; 28/32px are the dense and standard targets on
  // the density −2 tier (DESIGN §5).
  const box = $derived(size === "sm" ? "h-7 w-7" : "h-8 w-8");
  const px = $derived(size === "sm" ? 16 : 18);

  // `stateLayer` is `bg-current`, so reddening the *content* on hover reddens the
  // layer with it — the danger tone costs one class and no second hover rule.
  // This is the deliberate exception to §7's "no hand-written hover": the hover
  // drives the shared layer here rather than replacing it, and resting `--error`
  // would paint every close and discard glyph red at all times.
  const toneClass = $derived(
    active === true
      ? "bg-secondary-container text-on-secondary-container"
      : tone === "danger"
        // design-check-ignore no-hand-written-hover
        ? "text-on-surface-variant hover:text-error"
        : "text-on-surface-variant",
  );
</script>

<!-- No native `title`: it would duplicate the tooltip, and the two appear at
     different delays on top of each other. `aria-label` still carries the name.
     The tooltip's props land on this button rather than on a wrapper of its own,
     so there is one element and one tab stop. -->
<Tooltip label={title}>
  {#snippet children(tooltipProps)}
    <button
      {...tooltipProps}
      type="button"
      aria-label={title}
      aria-pressed={active}
      disabled={disabled || loading}
      {onclick}
      class="grid place-items-center rounded-full transition-colors duration-200 ease-standard
        {box} {stateLayer} {focusRing} {toneClass}"
    >
      {#if loading}
        <Spinner size="sm" />
      {:else}
        <Icon size={px} strokeWidth={2} />
      {/if}
    </button>
  {/snippet}
</Tooltip>
