<script lang="ts">
  import { ddl } from "$lib/stores/ddl.svelte";
  import TableDesigner from "./TableDesigner.svelte";
  import ColumnDialog from "./ColumnDialog.svelte";
  import IndexDialog from "./IndexDialog.svelte";
  import RenameDialog from "./RenameDialog.svelte";
  import DdlPreviewModal from "./DdlPreviewModal.svelte";

  // One host renders the active DDL dialog (mounted once in App, like ToastHost).
  const active = $derived(ddl.active);
</script>

{#if active?.type === "newTable"}
  <TableDesigner namespace={active.namespace} />
{:else if active?.type === "addColumn"}
  <ColumnDialog namespace={active.namespace} table={active.table} />
{:else if active?.type === "createIndex"}
  <IndexDialog namespace={active.namespace} table={active.table} columns={active.columns} />
{:else if active?.type === "renameTable"}
  <RenameDialog namespace={active.namespace} table={active.table} />
{:else if active?.type === "preview"}
  <DdlPreviewModal request={active.request} />
{/if}
