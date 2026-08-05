<script lang="ts">
  interface Props {
    checked?: boolean;
    label?: string;
    disabled?: boolean;
    id?: string;
    onchange?: (checked: boolean) => void;
  }

  let { checked = $bindable(false), label, disabled = false, id, onchange }: Props = $props();
</script>

<label
  class="inline-flex items-center gap-2 text-sm text-on-surface-variant select-none
    {disabled ? 'opacity-50' : 'cursor-pointer'}"
>
  <input
    {id}
    type="checkbox"
    {checked}
    {disabled}
    onchange={(e) => {
      checked = e.currentTarget.checked;
      onchange?.(checked);
    }}
    class="h-4 w-4 rounded-xs border-outline-variant bg-surface accent-primary"
  />
  {#if label}<span>{label}</span>{/if}
</label>
