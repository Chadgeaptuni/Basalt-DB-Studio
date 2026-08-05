<script lang="ts">
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import Modal from "$lib/components/ui/Modal.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import IconButton from "$lib/components/ui/IconButton.svelte";
  import Checkbox from "$lib/components/ui/Checkbox.svelte";
  import { ddl } from "$lib/stores/ddl.svelte";
  import type { ColumnSpec } from "$lib/api/types";

  interface Props {
    namespace: string;
  }
  let { namespace }: Props = $props();

  interface Draft {
    name: string;
    type: string;
    nullable: boolean;
    pk: boolean;
  }

  let name = $state("");
  let cols = $state<Draft[]>([{ name: "id", type: "integer", nullable: false, pk: true }]);

  const valid = $derived(
    name.trim().length > 0 && cols.every((c) => c.name.trim() && c.type.trim()),
  );

  function addCol(): void {
    cols.push({ name: "", type: "text", nullable: true, pk: false });
  }
  function removeCol(i: number): void {
    cols.splice(i, 1);
  }

  function preview(): void {
    const columns: ColumnSpec[] = cols.map((c) => ({
      name: c.name.trim(),
      typeName: c.type.trim(),
      nullable: c.nullable,
    }));
    const primaryKey = cols.filter((c) => c.pk).map((c) => c.name.trim());
    ddl.preview({ kind: "createTable", namespace, name: name.trim(), columns, primaryKey });
  }
</script>

<Modal open title="New table" size="lg" onclose={ddl.close}>
  <div class="flex flex-col gap-3">
    <label class="flex flex-col gap-1">
      <span class="text-xs tracking-wider text-on-surface-muted uppercase">Table name</span>
      <Input bind:value={name} placeholder="users" autofocus />
    </label>

    <div class="flex flex-col gap-1">
      <span class="text-xs tracking-wider text-on-surface-muted uppercase">Columns</span>
      <div class="flex flex-col gap-1.5">
        {#each cols as col, i (i)}
          <div class="flex items-center gap-2">
            <div class="w-40 shrink-0"><Input bind:value={col.name} placeholder="name" /></div>
            <div class="flex-1"><Input bind:value={col.type} placeholder="type" /></div>
            <Checkbox bind:checked={col.nullable} label="null" />
            <Checkbox bind:checked={col.pk} label="pk" />
            <IconButton
              icon={Trash2}
              title="Remove column"
              size="sm"
              disabled={cols.length === 1}
              onclick={() => removeCol(i)}
            />
          </div>
        {/each}
      </div>
      <div class="mt-1">
        <Button variant="ghost" size="sm" onclick={addCol}><Plus size={13} strokeWidth={2} /> Add column</Button>
      </div>
    </div>
    <p class="font-mono text-[11px] text-on-surface-muted">Types are raw SQL for this engine (e.g. varchar(50), serial).</p>
  </div>

  {#snippet footer()}
    <Button variant="ghost" size="sm" onclick={ddl.close}>Cancel</Button>
    <Button variant="primary" size="sm" disabled={!valid} onclick={preview}>Preview SQL</Button>
  {/snippet}
</Modal>
