<script lang="ts">
  import Modal from "$lib/components/ui/Modal.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Spinner from "$lib/components/ui/Spinner.svelte";
  import ErrorState from "$lib/components/ui/ErrorState.svelte";
  import { ddl } from "$lib/stores/ddl.svelte";
  import { ddlApi } from "$lib/api/ddl";
  import { queryApi } from "$lib/api/query";
  import { connections } from "$lib/stores/connections.svelte";
  import { schema } from "$lib/stores/schema.svelte";
  import { toast } from "$lib/stores/toasts.svelte";
  import type { DdlRequest, ErrorResponse } from "$lib/api/types";
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
  // Typed, not a string: a failed DDL statement and a thrown ApiError both carry
  // a `kind`, and it is what decides how the failure reads (DESIGN §8).
  let runError = $state<ErrorResponse | null>(null);

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
      if (failed?.error) {
        runError = failed.error;
        running = false;
        return;
      }
      // DDL changed the relations, not the server's database list — and on a
      // Postgres server session `clear` drops both, collapsing the branch the
      // database rows are drawn from.
      schema.clearTree(sess.sessionId);
      await schema.loadTree(sess.sessionId);
      toast.success("Applied.");
      ddl.close();
    } catch (e) {
      runError = e as ApiError;
      running = false;
    }
  }
</script>

<!-- -mx-3 on the error strips pulls their own px-3 back to the modal's gutter. -->
<Modal open title="Preview SQL" size="lg" onclose={ddl.close}>
  {#if genError}
    <div class="-mx-3">
      <ErrorState kind={genError.kind} message={genError.message} size="inline" />
    </div>
  {:else if sql === null}
    <div class="flex items-center gap-2 text-on-surface-muted"><Spinner size="sm" /> Generating…</div>
  {:else}
    <pre
      class="max-h-80 overflow-auto rounded-md border border-outline-variant bg-surface p-3 text-data whitespace-pre-wrap text-on-surface-variant">{sql}</pre>
    {#if runError}
      <div class="mt-2 -mx-3">
        <ErrorState kind={runError.kind} message={runError.message} size="inline" />
      </div>
    {/if}
  {/if}
  {#snippet footer()}
    <Button variant="text" size="sm" onclick={ddl.close}>Cancel</Button>
    <Button variant="filled" size="sm" disabled={sql === null} loading={running} onclick={execute}>
      Execute
    </Button>
  {/snippet}
</Modal>
