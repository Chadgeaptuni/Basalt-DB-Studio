<script lang="ts">
  import type { Snippet } from "svelte";
  import { Dialog } from "bits-ui";
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

  function handleOpenChange(next: boolean): void {
    open = next;
    if (!next) onclose?.();
  }

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

<Dialog.Root bind:open onOpenChange={handleOpenChange}>
  <Dialog.Portal>
    <Dialog.Overlay forceMount>
      {#snippet child({ props, open: overlayOpen })}
        {#if overlayOpen}
          <!-- Scrim: dimmed --surface, no blur (DESIGN §6). -->
          <div {...props} class="fixed inset-0 z-50 bg-surface/60" transition:uiFade></div>
        {/if}
      {/snippet}
    </Dialog.Overlay>

    <!-- The dvh cap keeps the frame inside the window (width is already viewport-
         relative); header/footer stay fixed and the body is the only scroller. -->
    <Dialog.Content
      forceMount
      restoreScrollDelay={120}
      class="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)]
        w-[calc(100%-2rem)] {maxw} flex-col -translate-x-1/2 -translate-y-1/2 outline-none"
    >
      {#snippet child({ props, open: contentOpen })}
        {#if contentOpen}
          <div {...props}>
            <div
              class="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-lg border
                border-outline-variant bg-surface-container-high"
              transition:uiScale
            >
              {#if !headerHidden}
                <header
                  class="flex shrink-0 items-center justify-between border-b border-outline-variant px-4 py-3"
                >
                  <Dialog.Title level={2} class="text-base font-medium text-on-surface">
                    {title}
                  </Dialog.Title>
                  <IconButton icon={X} title="Close" size="sm" onclick={close} />
                </header>
              {:else}
                <Dialog.Title level={2} class="sr-only">{title}</Dialog.Title>
              {/if}
              <div
                class="min-h-0 min-w-0 flex-1 text-sm text-on-surface-variant {padding
                  ? 'overflow-auto p-4'
                  : 'flex flex-col overflow-hidden'}"
              >
                {@render children()}
              </div>
              {#if footer}
                <footer
                  class="flex shrink-0 items-center justify-end gap-2 border-t border-outline-variant px-4 py-3"
                >
                  {@render footer()}
                </footer>
              {/if}
            </div>
          </div>
        {/if}
      {/snippet}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
