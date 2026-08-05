<script lang="ts">
  export interface SelectOption {
    value: string;
    label: string;
  }

  interface Props {
    value?: string;
    options: SelectOption[];
    disabled?: boolean;
    id?: string;
    onchange?: (value: string) => void;
  }

  let { value = $bindable(""), options, disabled = false, id, onchange }: Props = $props();
</script>

<select
  {id}
  {disabled}
  {value}
  onchange={(e) => {
    value = e.currentTarget.value;
    onchange?.(value);
  }}
  class="h-7 w-full rounded-md border border-outline-variant bg-surface px-2 text-sm text-on-surface
    transition-colors duration-150 focus:border-outline disabled:opacity-50"
>
  {#each options as opt (opt.value)}
    <option value={opt.value}>{opt.label}</option>
  {/each}
</select>
