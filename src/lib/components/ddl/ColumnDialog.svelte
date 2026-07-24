<script lang="ts">
  import Modal from "$lib/components/ui/Modal.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Checkbox from "$lib/components/ui/Checkbox.svelte";
  import { ddl } from "$lib/stores/ddl.svelte";

  interface Props {
    namespace: string;
    table: string;
  }
  let { namespace, table }: Props = $props();

  let name = $state("");
  let type = $state("text");
  let nullable = $state(true);
  let dflt = $state("");

  const valid = $derived(name.trim().length > 0 && type.trim().length > 0);

  function preview(): void {
    ddl.preview({
      kind: "addColumn",
      namespace,
      table,
      column: {
        name: name.trim(),
        typeName: type.trim(),
        nullable,
        default: dflt.trim() || undefined,
      },
    });
  }
</script>

<Modal open title={`Add column to ${table}`} onclose={ddl.close}>
  <div class="flex flex-col gap-3">
    <label class="flex flex-col gap-1">
      <span class="text-xs tracking-wider text-fg-2 uppercase">Name</span>
      <Input bind:value={name} placeholder="email" autofocus />
    </label>
    <label class="flex flex-col gap-1">
      <span class="text-xs tracking-wider text-fg-2 uppercase">Type</span>
      <Input bind:value={type} placeholder="varchar(255)" />
    </label>
    <label class="flex flex-col gap-1">
      <span class="text-xs tracking-wider text-fg-2 uppercase">Default (optional)</span>
      <Input bind:value={dflt} placeholder="e.g. 0 or 'x'" />
    </label>
    <Checkbox bind:checked={nullable} label="Nullable" />
  </div>

  {#snippet footer()}
    <Button variant="ghost" size="sm" onclick={ddl.close}>Cancel</Button>
    <Button variant="primary" size="sm" disabled={!valid} onclick={preview}>Preview SQL</Button>
  {/snippet}
</Modal>
