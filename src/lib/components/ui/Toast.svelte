<script lang="ts">
  import CircleCheck from "@lucide/svelte/icons/circle-check";
  import CircleX from "@lucide/svelte/icons/circle-x";
  import Info from "@lucide/svelte/icons/info";
  import X from "@lucide/svelte/icons/x";
  import IconButton from "./IconButton.svelte";

  // Dumb: kind restated locally so ui/ stays decoupled from the toasts store.
  type Kind = "success" | "error" | "info";
  interface Action {
    label: string;
    run: () => void;
  }
  interface Props {
    kind: Kind;
    message: string;
    action?: Action;
    ondismiss: () => void;
  }

  let { kind, message, action, ondismiss }: Props = $props();

  const icons = { success: CircleCheck, error: CircleX, info: Info };
  const tone = { success: "text-ok", error: "text-error", info: "text-primary" };
  const Icon = $derived(icons[kind]);
</script>

<div
  class="flex w-80 items-center gap-2 rounded-sm border border-outline-variant
    bg-surface-container-highest px-4 py-3 text-sm text-on-surface shadow-e2"
>
  <Icon size={16} strokeWidth={2} class={tone[kind]} />
  <span class="flex-1 truncate">{message}</span>
  {#if action}
    <button
      type="button"
      class="rounded-full px-2 py-1 text-xs font-medium text-primary
        transition-colors duration-200 ease-standard hover:bg-primary/8"
      onclick={() => {
        action.run();
        ondismiss();
      }}
    >
      {action.label}
    </button>
  {/if}
  <IconButton icon={X} title="Dismiss" size="sm" onclick={ondismiss} />
</div>
