<script lang="ts">
  import type { Snippet } from "svelte";
  import Spinner from "./Spinner.svelte";

  type Variant = "primary" | "secondary" | "ghost" | "danger";
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
    variant = "secondary",
    size = "md",
    type = "button",
    disabled = false,
    loading = false,
    title,
    onclick,
    children,
  }: Props = $props();

  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap select-none " +
    "transition-[background-color,border-color,color,opacity] duration-150 " +
    "disabled:opacity-50 disabled:pointer-events-none";
  const sizes: Record<Size, string> = { sm: "h-6 px-2 text-xs", md: "h-7 px-3 text-sm" };
  const variants: Record<Variant, string> = {
    primary: "bg-accent text-accent-fg hover:opacity-90",
    secondary: "bg-surface-container-high text-on-surface border border-outline-variant hover:border-outline",
    ghost: "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
    danger: "bg-danger-bg text-danger border border-danger/40 hover:border-danger",
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
