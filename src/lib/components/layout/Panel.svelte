<script lang="ts">
  import type { Snippet } from "svelte";

  // The chrome every rail destination wraps itself in: a 40px header carrying the
  // destination's title and its own actions, over a scrolling body.
  //
  // What this deliberately does *not* have is the accordion's collapse toggle and
  // inter-section drag handle. One panel at a time means a panel always owns the
  // full column, so there is nothing to collapse it against (DESIGN §5).
  interface Props {
    title: string;
    actions?: Snippet;
    children: Snippet;
  }
  let { title, actions, children }: Props = $props();
</script>

<section class="flex h-full min-h-0 flex-col">
  <header
    class="flex h-10 shrink-0 items-center gap-2 border-b border-outline-variant pr-1 pl-3"
  >
    <h2 class="min-w-0 flex-1 truncate text-label-sm tracking-wider text-on-surface-muted uppercase">
      {title}
    </h2>
    {#if actions}
      <div class="flex shrink-0 items-center">{@render actions()}</div>
    {/if}
  </header>

  <div class="flex min-h-0 flex-1 flex-col overflow-hidden">{@render children()}</div>
</section>
