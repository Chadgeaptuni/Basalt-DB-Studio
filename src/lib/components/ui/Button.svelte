<script lang="ts">
  import type { Snippet } from "svelte";
  import Spinner from "./Spinner.svelte";
  import { stateLayer, focusRing, destructiveFill } from "./stateLayer";

  // The M3 button family (DESIGN §6). The `primary`/`secondary`/`ghost` aliases
  // are gone — every call site now names the M3 variant it means.
  type Variant = "filled" | "tonal" | "outlined" | "text" | "text-error" | "danger";
  type Size = "sm" | "md";

  interface Props {
    variant?: Variant;
    size?: Size;
    type?: "button" | "submit";
    disabled?: boolean;
    loading?: boolean;
    title?: string;
    onclick?: (e: MouseEvent) => void;
    children: Snippet;
  }

  let {
    variant = "outlined",
    size = "md",
    type = "button",
    disabled = false,
    loading = false,
    title,
    onclick,
    children,
  }: Props = $props();

  // M3 buttons are pills. Both sizes sit on the density −2 tier (DESIGN §5): 32px
  // is the standard control, 28px the dense in-toolbar one.
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full whitespace-nowrap " +
    `select-none text-label-lg ${stateLayer} ${focusRing}`;
  const sizes: Record<Size, string> = { sm: "h-7 px-3", md: "h-8 px-5" };
  const variants: Record<Variant, string> = {
    filled: "bg-primary text-on-primary",
    tonal: "bg-primary-container text-on-primary-container",
    outlined: "border border-outline text-on-surface",
    text: "text-primary",
    // The text button *inside* an error surface — primary blue on an error
    // container reads as an unrelated link and fails contrast.
    "text-error": "text-on-error-container",
    // Outlined at rest, filled on hover/focus (DESIGN §7): the destructive
    // confirm must not sit in a dialog looking like the button you press to get
    // on with your day.
    danger: destructiveFill,
  };
</script>

<button
  {type}
  {title}
  disabled={disabled || loading}
  {onclick}
  class="{base} {sizes[size]} {variants[variant]}"
>
  {#if loading}<Spinner size="sm" />{/if}
  {@render children()}
</button>
