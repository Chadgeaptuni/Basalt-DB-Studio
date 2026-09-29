<script lang="ts">
  // Host for the connections store's password request: a connect the server or
  // the keychain turned away, waiting on a password. Mounted once in App.svelte.
  import PromptDialog from "$lib/components/ui/PromptDialog.svelte";
  import Checkbox from "$lib/components/ui/Checkbox.svelte";
  import { presentError } from "$lib/utils/errorPresentation";
  import { connections } from "$lib/stores/connections.svelte";

  const request = $derived(connections.passwordRequest);
  // Without a keychain there is nowhere to save it, so the box starts cleared.
  let remember = $state(true);
  $effect(() => {
    remember = request?.kind !== "keychainUnavailable";
  });
</script>

{#if request}
  <PromptDialog
    title={`Password for “${request.name}”`}
    label="Password"
    hint={presentError(request.kind).title}
    confirmLabel="Connect"
    secret
    onsubmit={(password) => request.answer({ password, remember })}
    onclose={() => request.answer(null)}
  >
    <Checkbox bind:checked={remember} label="Save in the OS keychain" />
  </PromptDialog>
{/if}
