<script lang="ts">
  import type { Snippet } from "svelte";

  // The small static status marker (DESIGN §6) — `TX`, `limit`, engine tags. It is
  // deliberately *not* an M3 chip: a chip is a 32px interactive object, and these
  // live inside 32px bars where a chip would fill the bar edge to edge.
  type Variant = "neutral" | "primary" | "ok" | "warn" | "error";

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
    ok: "bg-surface-container-high text-ok border border-ok/40",
    warn: "bg-surface-container-high text-warn border border-warn/40",
    error: "bg-error-container text-on-error-container",
  };
</script>

<span
  {title}
  class="inline-flex h-5 items-center rounded-full px-2 text-label-sm
    uppercase tracking-wide {styles[variant]} {cls}"
>
  {@render children()}
</span>
