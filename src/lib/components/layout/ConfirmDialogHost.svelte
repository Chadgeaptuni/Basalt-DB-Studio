<script lang="ts">
  // Smart host for the global confirm() service. Mounted once in App.svelte.
  import { dialogs } from "$lib/stores/dialogs.svelte";
  import ConfirmDialog from "$lib/components/ui/ConfirmDialog.svelte";
</script>

{#if dialogs.active}
  {#key dialogs.active.id}
    <ConfirmDialog
      title={dialogs.active.title}
      message={dialogs.active.message}
      confirmLabel={dialogs.active.confirmLabel}
      cancelLabel={dialogs.active.cancelLabel}
      variant={dialogs.active.variant}
      onconfirm={dialogs.accept}
      oncancel={dialogs.cancel}
    />
  {/key}
{/if}
