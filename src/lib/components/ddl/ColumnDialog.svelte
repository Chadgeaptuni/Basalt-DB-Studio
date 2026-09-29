<script lang="ts">
  import Modal from "$lib/components/ui/Modal.svelte";
  import Field from "$lib/components/ui/Field.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Checkbox from "$lib/components/ui/Checkbox.svelte";
  import { untrack } from "svelte";
  import { ddl } from "$lib/stores/ddl.svelte";
  import { connections } from "$lib/stores/connections.svelte";
  import type { ColumnSpec } from "$lib/api/types";

  // Adds a column, or with `column` changes that one's type, nullability and
  // default. The name is fixed when editing — renaming is its own action.
  interface Props {
    namespace: string;
    table: string;
    column?: ColumnSpec;
  }
  let { namespace, table, column }: Props = $props();

  const seed = untrack(() => column);
  let name = $state(seed?.name ?? "");
  let type = $state(seed?.typeName ?? "text");
  let nullable = $state(seed?.nullable ?? true);
  let dflt = $state("");
  // MODIFY restates the whole column, so an existing default the form never
  // showed would be dropped.
  const resetsDefault = $derived(Boolean(seed) && connections.active?.engine === "mysql");

  const valid = $derived(name.trim().length > 0 && type.trim().length > 0);

  function preview(): void {
    const spec = { name: name.trim(), typeName: type.trim(), nullable, default: dflt.trim() || undefined };
    ddl.preview(
      seed
        ? { kind: "alterColumn", namespace, table, column: spec }
        : { kind: "addColumn", namespace, table, column: spec },
    );
  }
</script>

<Modal open title={seed ? `Change ${seed.name}` : `Add column to ${table}`} onclose={ddl.close}>
  <div class="flex flex-col gap-3">
    {#if !seed}
      <Field label="Name">
        <Input bind:value={name} placeholder="email" autofocus />
      </Field>
    {/if}
    <Field label="Type">
      <Input bind:value={type} placeholder="varchar(255)" autofocus={Boolean(seed)} />
    </Field>
    <Field
      label="Default (optional)"
      hint={resetsDefault
        ? "MySQL rewrites the whole column: enter the current default again to keep it."
        : seed
          ? "Blank keeps the current default."
          : undefined}
    >
      <Input bind:value={dflt} placeholder="e.g. 0 or 'x'" />
    </Field>
    <Checkbox bind:checked={nullable} label="Nullable" />
  </div>

  {#snippet footer()}
    <Button variant="text" size="sm" onclick={ddl.close}>Cancel</Button>
    <Button variant="filled" size="sm" disabled={!valid} onclick={preview}>Preview SQL</Button>
  {/snippet}
</Modal>
