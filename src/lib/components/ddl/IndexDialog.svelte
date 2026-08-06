<script lang="ts">
  import Modal from "$lib/components/ui/Modal.svelte";
  import Field from "$lib/components/ui/Field.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Checkbox from "$lib/components/ui/Checkbox.svelte";
  import { untrack } from "svelte";
  import { ddl } from "$lib/stores/ddl.svelte";

  interface Props {
    namespace: string;
    table: string;
    columns: string[];
  }
  let { namespace, table, columns }: Props = $props();

  // Fresh dialog per open, so the initial value is intentional (not reactive).
  let name = $state(untrack(() => `${table}_idx`));
  let unique = $state(false);
  let picked = $state<Record<string, boolean>>({});

  const chosen = $derived(columns.filter((c) => picked[c]));
  const valid = $derived(name.trim().length > 0 && chosen.length > 0);

  function preview(): void {
    ddl.preview({
      kind: "createIndex",
      namespace,
      table,
      name: name.trim(),
      columns: chosen,
      unique,
    });
  }
</script>

<Modal open title={`New index on ${table}`} onclose={ddl.close}>
  <div class="flex flex-col gap-3">
    <Field label="Index name">
      <Input bind:value={name} autofocus />
    </Field>
    <div class="flex flex-col gap-1">
      <span class="text-label-sm tracking-wider text-on-surface-muted uppercase">Columns</span>
      <div class="flex flex-col gap-1 rounded-md border border-outline-variant bg-surface p-2">
        {#each columns as col (col)}
          <Checkbox bind:checked={picked[col]} label={col} />
        {/each}
        {#if columns.length === 0}<span class="text-body-sm text-on-surface-muted">No columns.</span>{/if}
      </div>
    </div>
    <Checkbox bind:checked={unique} label="Unique" />
  </div>

  {#snippet footer()}
    <Button variant="text" size="sm" onclick={ddl.close}>Cancel</Button>
    <Button variant="filled" size="sm" disabled={!valid} onclick={preview}>Preview SQL</Button>
  {/snippet}
</Modal>
