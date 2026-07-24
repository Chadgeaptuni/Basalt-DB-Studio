<script lang="ts">
  import type { Snippet } from "svelte";
  import X from "@lucide/svelte/icons/x";
  import IconButton from "./IconButton.svelte";
  import { uiFade, uiScale } from "$lib/utils/motion";

  interface Props {
    open?: boolean;
    title: string;
    size?: "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl";
    headerHidden?: boolean;
    padding?: boolean;
    onclose?: () => void;
    children: Snippet;
    footer?: Snippet;
  }

  let {
    open = $bindable(false),
    title,
    size = "md",
    headerHidden = false,
    padding = true,
    onclose,
    children,
    footer,
  }: Props = $props();

  function close(): void {
    open = false;
    onclose?.();
  }

  // Overlay-local Escape (not a global app shortcut, so it stays out of the
  // keyboard registry — overlapping overlays would collide on one Escape key).
  $effect(() => {
    if (!open) return;
    const onkey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", onkey);
    return () => window.removeEventListener("keydown", onkey);
  });

  const maxw = $derived(
    size === "4xl"
      ? "max-w-6xl w-[94vw]"
      : size === "3xl"
        ? "max-w-5xl w-full"
        : size === "2xl"
          ? "max-w-4xl w-full"
          : size === "xl"
            ? "max-w-3xl w-full"
            : size === "lg"
              ? "max-w-lg"
              : "max-w-md"
  );
</script>

{#if open}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <!-- Scrim: dimmed --bg-0, no blur (DESIGN §6). -->
    <button
      type="button"
      aria-label="Close"
      tabindex="-1"
      class="absolute inset-0 bg-bg-0/60"
      onclick={close}
      transition:uiFade
    ></button>
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      class="relative z-10 w-full {maxw} rounded-lg border border-border bg-bg-2"
      transition:uiScale
    >
      {#if !headerHidden}
        <header class="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 class="text-base font-medium text-fg-0">{title}</h2>
          <IconButton icon={X} title="Close" size="sm" onclick={close} />
        </header>
      {/if}
      <div class={padding ? "p-4 text-sm text-fg-1" : "text-sm text-fg-1"}>{@render children()}</div>
      {#if footer}
        <footer
          class="flex items-center justify-end gap-2 border-t border-border px-4 py-3"
        >
          {@render footer()}
        </footer>
      {/if}
    </div>
  </div>
{/if}
