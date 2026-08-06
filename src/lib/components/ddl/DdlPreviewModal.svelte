<script lang="ts">
  import Modal from "$lib/components/ui/Modal.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Spinner from "$lib/components/ui/Spinner.svelte";
  import { ddl } from "$lib/stores/ddl.svelte";
  import { ddlApi } from "$lib/api/ddl";
  import { queryApi } from "$lib/api/query";
  import { connections } from "$lib/stores/connections.svelte";
  import { schema } from "$lib/stores/schema.svelte";
  import { toast } from "$lib/stores/toasts.svelte";
  import type { DdlRequest } from "$lib/api/types";
  import type { ApiError } from "$lib/api/client";

  // Every DDL is previewed here before it runs (spec gate). Execution goes through
  // the normal run path (confirmed), then refreshes the schema cache.
  interface Props {
    request: DdlRequest;
  }
  let { request }: Props = $props();

  const sess = $derived(connections.active);
  let sql = $state<string | null>(null);
  let genError = $state<ApiError | null>(null);
  let running = $state(false);
  let runError = $state<string | null>(null);

  $effect(() => {
    const s = sess;
    const req = request;
    if (!s) return;
    sql = null;
    genError = null;
    ddlApi
      .generate(s.sessionId, req)
      .then((out) => (sql = out))
      .catch((e) => (genError = e as ApiError));
  });

  async function execute(): Promise<void> {
    if (!sess || sql === null) return;
    running = true;
    runError = null;
    try {
      const result = await queryApi.run(sess.sessionId, sql, { confirmed: true });
      const failed = result.statements.find((s) => s.error);
      if (failed) {
        runError = failed.error?.message ?? "DDL failed";
        running = false;
        return;
      }
      // DDL changed the schema — clear the cache and reload the tree.
      schema.clear(sess.sessionId);
      await schema.loadTree(sess.sessionId);
      toast.success("Applied.");
      ddl.close();
    } catch (e) {
      runError = (e as ApiError).message;
      running = false;
    }
  }
</script>

<Modal open title="Preview SQL" size="lg" onclose={ddl.close}>
  {#if genError}
    <p class="text-data text-error">{genError.message}</p>
  {:else if sql === null}
    <div class="flex items-center gap-2 text-on-surface-muted"><Spinner size="sm" /> Generating…</div>
  {:else}
    <pre
      class="max-h-80 overflow-auto rounded-md border border-outline-variant bg-surface p-3 text-data whitespace-pre-wrap text-on-surface-variant">{sql}</pre>
    {#if runError}
      <p class="mt-2 text-data whitespace-pre-wrap text-error">{runError}</p>
    {/if}
  {/if}
  {#snippet footer()}
    <Button variant="text" size="sm" onclick={ddl.close}>Cancel</Button>
    <Button variant="filled" size="sm" disabled={sql === null} loading={running} onclick={execute}>
      Execute
    </Button>
  {/snippet}
</Modal>
