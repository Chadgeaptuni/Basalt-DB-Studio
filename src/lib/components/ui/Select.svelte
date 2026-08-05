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
  class="h-10 w-full rounded-sm border border-outline-variant bg-surface px-4 text-sm
    text-on-surface transition-colors duration-200 ease-standard disabled:opacity-[0.38]
    focus:outline-2 focus:-outline-offset-1 focus:outline-primary"
>
  {#each options as opt (opt.value)}
    <option value={opt.value}>{opt.label}</option>
  {/each}
</select>
