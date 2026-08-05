<script lang="ts">
  import Modal from "$lib/components/ui/Modal.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import { untrack } from "svelte";
  import { ddl } from "$lib/stores/ddl.svelte";

  interface Props {
    namespace: string;
    table: string;
  }
  let { namespace, table }: Props = $props();

  // Fresh dialog per open, so the initial value is intentional (not reactive).
  let newName = $state(untrack(() => table));
  const valid = $derived(newName.trim().length > 0 && newName.trim() !== table);

  function preview(): void {
    ddl.preview({ kind: "renameTable", namespace, name: table, newName: newName.trim() });
  }
</script>

<Modal open title={`Rename ${table}`} onclose={ddl.close}>
  <label class="flex flex-col gap-1">
    <span class="text-xs tracking-wider text-on-surface-muted uppercase">New name</span>
    <Input bind:value={newName} autofocus />
  </label>

  {#snippet footer()}
    <Button variant="ghost" size="sm" onclick={ddl.close}>Cancel</Button>
    <Button variant="primary" size="sm" disabled={!valid} onclick={preview}>Preview SQL</Button>
  {/snippet}
</Modal>
