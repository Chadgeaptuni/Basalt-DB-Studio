<script lang="ts">
  import type { Snippet } from "svelte";

  type Variant = "neutral" | "accent" | "ok" | "warn" | "danger";

  interface Props {
    variant?: Variant;
    title?: string;
    class?: string;
    children: Snippet;
  }

  let { variant = "neutral", title, class: cls = "", children }: Props = $props();

  const styles: Record<Variant, string> = {
    neutral: "bg-surface-container-high text-on-surface-muted border-outline-variant",
    accent: "bg-surface-container-high text-accent border-outline-variant",
    ok: "bg-surface-container-high text-ok border-outline-variant",
    warn: "bg-surface-container-high text-warn border-outline-variant",
    danger: "bg-danger-bg text-danger border-danger/40",
  };
</script>

<span
  {title}
  class="inline-flex h-4 items-center rounded-full border px-1.5 font-mono text-[10px]
    font-medium uppercase tracking-wide {styles[variant]} {cls}"
>
  {@render children()}
</span>
