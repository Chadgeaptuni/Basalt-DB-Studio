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

  // M3 buttons are pills. Heights are M3 small (32) and standard (40) — the
  // densest values that still clear M3's 32px minimum target.
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap " +
    `select-none ${stateLayer} ${focusRing}`;
  const sizes: Record<Size, string> = { sm: "h-8 px-3 text-xs", md: "h-10 px-6 text-sm" };
  const variants: Record<Variant, string> = {
    filled: "bg-primary text-on-primary",
    tonal: "bg-primary-container text-on-primary-container",
    outlined: "border border-outline text-on-surface",
    text: "text-primary",
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
