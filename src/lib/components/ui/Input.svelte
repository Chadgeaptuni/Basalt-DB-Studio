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
  class="h-7 w-full rounded-md border bg-bg-0 px-2 text-sm text-fg-0
    transition-colors duration-150 placeholder:text-fg-2 disabled:opacity-50
    {bad ? 'border-danger' : 'border-border focus:border-border-strong'}"
/>
{#if error}<p class="mt-1 text-xs text-danger">{error}</p>{/if}
