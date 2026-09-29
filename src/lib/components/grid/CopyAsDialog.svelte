<script lang="ts">
  import Modal from "$lib/components/ui/Modal.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Checkbox from "$lib/components/ui/Checkbox.svelte";
  import SegmentedButton, { type Segment } from "$lib/components/ui/SegmentedButton.svelte";
  import { copyText, toDelimited } from "$lib/utils/copy";
  import { toast } from "$lib/stores/toasts.svelte";
  import type { CellValue } from "$lib/api/types";

  // Copy the grid as it is shown — its rows in their current order, its visible
  // columns — with the delimiter, header and NULL spelling chosen here.
  interface Props {
    names: string[];
    matrix: CellValue[][];
    onclose: () => void;
  }
  let { names, matrix, onclose }: Props = $props();

  const DELIMITERS: Segment[] = [
    { value: "\t", label: "Tab" },
    { value: ",", label: "Comma" },
    { value: ";", label: "Semicolon" },
    { value: "|", label: "Pipe" },
  ];
  let delimiter = $state("\t");
  let header = $state(true);
  let nullAsText = $state(false);

  async function copy(): Promise<void> {
    await copyText(toDelimited(names, matrix, { delimiter, header, nullText: nullAsText ? "NULL" : "" }));
    toast.success(`Copied ${matrix.length} row${matrix.length === 1 ? "" : "s"}.`);
    onclose();
  }
</script>

<Modal open title="Copy rows as…" size="md" {onclose}>
  <div class="flex flex-col gap-3">
    <div class="flex flex-col gap-1">
      <span class="text-overline">Delimiter</span>
      <SegmentedButton label="Delimiter" segments={DELIMITERS} value={delimiter} onchange={(v) => (delimiter = v)} />
    </div>
    <Checkbox bind:checked={header} label="Include column names" />
    <Checkbox bind:checked={nullAsText} label="Write NULL as NULL instead of empty" />
    <p class="text-body-sm text-on-surface-muted">
      {matrix.length} rows × {names.length} columns, in the order shown.
    </p>
  </div>
  {#snippet footer()}
    <Button variant="text" onclick={onclose}>Cancel</Button>
    <Button variant="filled" onclick={copy}>Copy</Button>
  {/snippet}
</Modal>
