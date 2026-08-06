<script lang="ts">
  import Search from "@lucide/svelte/icons/search";
  import X from "@lucide/svelte/icons/x";
  import { stateLayer, focusRing } from "./stateLayer";

  // M3 docked search field (DESIGN §6): a 32px pill on the inset-well surface,
  // leading search icon, trailing clear once there is something to clear.
  //
  // Filtering is the caller's job — this only owns the text. Nothing here debounces
  // or fetches: every consumer filters an in-memory list, so a keystroke costs no
  // IPC (DESIGN §10).
  interface Props {
    value?: string;
    placeholder?: string;
    /** Doubles as the accessible name — the field carries no visible label. */
    label: string;
    autofocus?: boolean;
    onkeydown?: (e: KeyboardEvent) => void;
  }

  let {
    value = $bindable(""),
    placeholder,
    label,
    autofocus = false,
    onkeydown,
  }: Props = $props();

  let input = $state<HTMLInputElement>();

  export function focus(): void {
    input?.focus();
  }

  function clear(): void {
    value = "";
    input?.focus();
  }
</script>

<div
  class="flex h-8 w-full items-center gap-2 rounded-full bg-surface-container-low pr-1 pl-3
    focus-within:outline-2 focus-within:-outline-offset-1 focus-within:outline-primary"
>
  <Search size={16} strokeWidth={2} class="shrink-0 text-on-surface-muted" aria-hidden="true" />
  <!-- svelte-ignore a11y_autofocus -->
  <input
    bind:this={input}
    bind:value
    type="text"
    aria-label={label}
    {placeholder}
    {autofocus}
    {onkeydown}
    class="min-w-0 flex-1 bg-transparent text-body-md text-on-surface outline-none
      placeholder:text-on-surface-muted"
  />
  {#if value}
    <button
      type="button"
      aria-label="Clear search"
      onclick={clear}
      class="grid h-6 w-6 shrink-0 place-items-center rounded-full text-on-surface-muted
        {stateLayer} {focusRing}"
    >
      <X size={14} strokeWidth={2} />
    </button>
  {/if}
</div>
