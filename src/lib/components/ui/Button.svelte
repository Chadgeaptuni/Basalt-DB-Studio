<script lang="ts">
  import type { Snippet } from "svelte";
  import Spinner from "./Spinner.svelte";
  import { stateLayer, focusRing } from "./stateLayer";

  // The M3 button family (DESIGN §6). `primary`/`secondary`/`ghost` are kept as
  // aliases of `filled`/`outlined`/`text` so call sites migrate incrementally.
  type Variant =
    | "filled"
    | "tonal"
    | "outlined"
    | "text"
    | "text-error"
    | "danger"
    | "primary"
    | "secondary"
    | "ghost";
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
    danger: "bg-error-container text-on-error-container",
    primary: "bg-primary text-on-primary",
    secondary: "border border-outline text-on-surface",
    ghost: "text-on-surface-variant",
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
