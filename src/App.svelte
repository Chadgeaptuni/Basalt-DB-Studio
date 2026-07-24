<script lang="ts">
  import AppShell from "$lib/components/layout/AppShell.svelte";
  import ToastHost from "$lib/components/layout/ToastHost.svelte";
  import ConfirmDialogHost from "$lib/components/layout/ConfirmDialogHost.svelte";
  import DdlHost from "$lib/components/ddl/DdlHost.svelte";
  import SaveQueryDialog from "$lib/components/savedQueries/SaveQueryDialog.svelte";
  import { saveQuery } from "$lib/stores/saveQuery.svelte";
</script>

<AppShell />
<ToastHost />
<ConfirmDialogHost />
<DdlHost />
{#if saveQuery.promptOpen}<SaveQueryDialog />{/if}
