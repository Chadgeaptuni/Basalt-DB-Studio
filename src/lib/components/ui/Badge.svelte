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
    neutral: "bg-bg-2 text-fg-2 border-border",
    accent: "bg-bg-2 text-accent border-border",
    ok: "bg-bg-2 text-ok border-border",
    warn: "bg-bg-2 text-warn border-border",
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
