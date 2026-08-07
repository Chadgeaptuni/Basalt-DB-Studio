<script lang="ts">
  import { FIELD_BOX } from "./field";

  // Dynamic `type` rules out Svelte's `bind:value`, so we drive the $bindable
  // value through oninput manually (still two-way for callers via bind:value).
  interface Props {
    value?: string;
    type?: "text" | "password" | "number" | "email" | "search";
    /**
     * Accessible name, for the layouts that put the visible label somewhere a
     * `<label for>` can't reach it — a settings row states the label in a text
     * column of its own, several elements away from this control.
     */
    label?: string;
    placeholder?: string;
    disabled?: boolean;
    invalid?: boolean;
    error?: string;
    id?: string;
    autofocus?: boolean;
    oninput?: (e: Event) => void;
    onkeydown?: (e: KeyboardEvent) => void;
  }

  let {
    value = $bindable(""),
    type = "text",
    label,
    placeholder,
    disabled = false,
    invalid = false,
    error,
    id,
    autofocus = false,
    oninput,
    onkeydown,
  }: Props = $props();

  const bad = $derived(invalid || Boolean(error));
</script>

<!-- svelte-ignore a11y_autofocus -->
<input
  {id}
  {type}
  {placeholder}
  {disabled}
  {autofocus}
  {value}
  oninput={(e) => {
    value = e.currentTarget.value;
    oninput?.(e);
  }}
  {onkeydown}
  aria-label={label}
  aria-invalid={bad}
  class="{FIELD_BOX} no-native-spinner px-3 text-on-surface
    placeholder:text-on-surface-muted focus:outline-2 focus:-outline-offset-1
    {bad
    ? 'border-error focus:outline-error'
    : 'border-outline-variant focus:outline-primary'}"
/>
{#if error}<p class="mt-1 px-3 text-body-sm text-error">{error}</p>{/if}
