<script lang="ts">
  // Dynamic `type` rules out Svelte's `bind:value`, so we drive the $bindable
  // value through oninput manually (still two-way for callers via bind:value).
  interface Props {
    value?: string;
    type?: "text" | "password" | "number" | "email" | "search";
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
  aria-invalid={bad}
  class="h-10 w-full rounded-sm border bg-surface px-4 text-sm text-on-surface
    transition-colors duration-200 ease-standard placeholder:text-on-surface-muted
    disabled:opacity-[0.38] focus:outline-2 focus:-outline-offset-1
    {bad
    ? 'border-error focus:outline-error'
    : 'border-outline-variant focus:outline-primary'}"
/>
{#if error}<p class="mt-1 px-4 text-xs text-error">{error}</p>{/if}
