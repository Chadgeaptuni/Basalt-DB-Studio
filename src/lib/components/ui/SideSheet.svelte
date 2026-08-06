<script lang="ts">
  import type { Snippet } from "svelte";
  import X from "@lucide/svelte/icons/x";
  import IconButton from "./IconButton.svelte";
  import { uiSlide } from "$lib/utils/motion";

  // M3 side sheet (DESIGN §6): a floating panel on the trailing edge of its
  // container, over the content rather than beside it.
  //
  // Deliberately *not* a dialog. The inspector exists so you can read a cell while
  // still moving around the grid — a modal would trap focus and block the arrow
  // keys that make it useful. It is `absolute` inside the grid's own container for
  // the same reason: it must not displace or resize the rows underneath.
  interface Props {
    title: string;
    /** Width in px. The grid stays usable beside it, so this is not full-bleed. */
    width?: number;
    onclose: () => void;
    children: Snippet;
  }
  let { title, width = 360, onclose, children }: Props = $props();
</script>

<aside
  aria-label={title}
  transition:uiSlide={{ axis: "x" }}
  style="width:min({width}px, 100%)"
  class="absolute inset-y-0 right-0 z-20 flex flex-col rounded-l-md border-l border-outline-variant
    bg-surface-container-high shadow-e2"
>
  <header
    class="flex h-10 shrink-0 items-center gap-2 border-b border-outline-variant pr-1 pl-3"
  >
    <h2 class="min-w-0 flex-1 truncate text-title-sm text-on-surface">{title}</h2>
    <IconButton icon={X} title="Close inspector" size="sm" onclick={onclose} />
  </header>

  <div class="min-h-0 flex-1 overflow-auto">{@render children()}</div>
</aside>
