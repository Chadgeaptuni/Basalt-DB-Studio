<script lang="ts">
  import type { Snippet } from "svelte";

  // M3 chip (DESIGN §6). `accent`/`danger` stay as aliases while call sites migrate.
  type Variant = "neutral" | "primary" | "ok" | "warn" | "error" | "accent" | "danger";

  interface Props {
    variant?: Variant;
    title?: string;
    class?: string;
    children: Snippet;
  }

  let { variant = "neutral", title, class: cls = "", children }: Props = $props();

  // M3 chips are tonal fills, not outlined pills — the container role carries the
  // meaning, so only `warn`/`ok` (no M3 container role of their own) keep a border.
  const styles: Record<Variant, string> = {
    neutral: "bg-secondary-container text-on-secondary-container",
    primary: "bg-primary-container text-on-primary-container",
    accent: "bg-primary-container text-on-primary-container",
    ok: "bg-surface-container-high text-ok border border-ok/40",
    warn: "bg-surface-container-high text-warn border border-warn/40",
    error: "bg-error-container text-on-error-container",
    danger: "bg-error-container text-on-error-container",
  };
</script>

<span
  {title}
  class="inline-flex h-5 items-center rounded-full px-2 font-mono text-[10px]
    font-medium uppercase tracking-wide {styles[variant]} {cls}"
>
  {@render children()}
</span>
