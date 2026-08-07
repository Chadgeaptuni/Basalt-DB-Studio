<script lang="ts">
  import { untrack } from "svelte";
  import Select, { type SelectOption } from "./Select.svelte";

  // A harness rather than rendering `Select` directly: the trigger reads back
  // from `value`, so proving a click actually changes the selection needs a real
  // two-way binding on the other end of it.
  interface Props {
    options: SelectOption[];
    initial?: string;
    onchange?: (value: string) => void;
  }
  let { options, initial = "", onchange }: Props = $props();

  // Seed only — each test renders its own harness, so `initial` never changes
  // under it and reacting to it would fight the binding being tested.
  let value = $state(untrack(() => initial));
</script>

<Select label="Environment" bind:value {options} {onchange} />
<p data-testid="bound">{value}</p>
