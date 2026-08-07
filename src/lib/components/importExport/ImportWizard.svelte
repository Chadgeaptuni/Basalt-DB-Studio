<script lang="ts">
  import { open } from "@tauri-apps/plugin-dialog";
  import { untrack } from "svelte";
  import FileText from "@lucide/svelte/icons/file-text";
  import Modal from "$lib/components/ui/Modal.svelte";
  import Field from "$lib/components/ui/Field.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Checkbox from "$lib/components/ui/Checkbox.svelte";
  import Select from "$lib/components/ui/Select.svelte";
  import Stepper, { type Step } from "$lib/components/ui/Stepper.svelte";
  import ErrorState from "$lib/components/ui/ErrorState.svelte";
  import { ioApi } from "$lib/api/io";
  import { connections } from "$lib/stores/connections.svelte";
  import { toast } from "$lib/stores/toasts.svelte";
  import type { ConflictMode, ErrorResponse } from "$lib/api/types";
  import type { ApiError } from "$lib/api/client";

  // CSV import wizard: pick a file, choose which target columns the CSV maps to (in
  // order), header + conflict mode, then import. Errors surface with the offending
  // line (importParse).
  interface Props {
    namespace: string;
    table: string;
    columns: string[];
    onclose: () => void;
  }
  let { namespace, table, columns, onclose }: Props = $props();

  const sess = $derived(connections.active);
  let path = $state<string | null>(null);
  let hasHeader = $state(true);
  let conflict = $state("insert");
  // Fresh wizard per open, so the initial mapping is intentional (not reactive).
  let picked = $state<Record<string, boolean>>(
    untrack(() => Object.fromEntries(columns.map((c) => [c, true]))),
  );
  let running = $state(false);
  let error = $state<ErrorResponse | null>(null);

  const chosen = $derived(columns.filter((c) => picked[c]));
  const conflictOptions = [
    { value: "insert", label: "Insert (fail on conflict)" },
    { value: "skip", label: "Skip duplicates" },
    { value: "upsert", label: "Upsert (update on conflict)" },
  ];

  // Three steps, because the decisions are genuinely sequential: without a file
  // there is nothing to map, and mapping is what makes the conflict mode mean
  // anything. A single scrolling form let you hit Import having silently skipped
  // the mapping.
  const STEPS: Step[] = [
    { id: "file", label: "File" },
    { id: "columns", label: "Columns" },
    { id: "options", label: "Options" },
  ];
  let step = $state(0);

  // Gate per step so "Next" can never advance past an unanswered decision.
  const canAdvance = $derived(step === 0 ? Boolean(path) : step === 1 ? chosen.length > 0 : true);
  const onLastStep = $derived(step === STEPS.length - 1);

  async function browse(): Promise<void> {
    const file = await open({ filters: [{ name: "CSV", extensions: ["csv"] }], multiple: false });
    if (typeof file === "string") path = file;
  }

  async function run(): Promise<void> {
    if (!sess || !path || chosen.length === 0) return;
    running = true;
    error = null;
    try {
      const result = await ioApi.importCsv(
        sess.sessionId,
        namespace,
        table,
        chosen,
        hasHeader,
        conflict as ConflictMode,
        path,
      );
      toast.success(`Imported ${result.inserted} rows`);
      onclose();
    } catch (e) {
      const err = e as ApiError;
      // importParse carries the offending line; prefix it so the message names
      // the row to go fix, which is the whole point of the detail payload.
      const line = (err.detail as { line?: number } | undefined)?.line;
      error = { kind: err.kind, message: line ? `Line ${line}: ${err.message}` : err.message };
    } finally {
      running = false;
    }
  }
</script>

<Modal open title={`Import CSV into ${table}`} size="lg" {onclose}>
  <div class="flex flex-col gap-4">
    <Stepper steps={STEPS} current={step} />

    {#if step === 0}
      <div class="flex flex-col gap-2">
        <Button variant="outlined" size="sm" onclick={browse}>
          <FileText size={14} strokeWidth={2} /> Choose CSV…
        </Button>
        <span class="truncate text-data {path ? 'text-on-surface-variant' : 'text-on-surface-muted'}">
          {path ?? "No file selected"}
        </span>
      </div>
    {:else if step === 1}
      <div class="flex flex-col gap-2">
        <span class="text-label-sm tracking-wider text-on-surface-muted uppercase">
          Target columns (in CSV order)
        </span>
        <div
          class="flex max-h-64 flex-col gap-1 overflow-auto rounded-sm border border-outline-variant
            bg-surface p-2"
        >
          {#each columns as col (col)}
            <Checkbox bind:checked={picked[col]} label={col} />
          {/each}
        </div>
        <span class="text-label-sm text-on-surface-muted tabular-nums">
          {chosen.length} of {columns.length} selected
        </span>
      </div>
    {:else}
      <div class="flex flex-col gap-3">
        <Field label="Conflict mode">
          <Select label="Conflict mode" bind:value={conflict} options={conflictOptions} />
        </Field>
        <Checkbox bind:checked={hasHeader} label="First row is a header" />
        <p class="text-body-sm text-on-surface-muted">
          Importing {chosen.length} column{chosen.length === 1 ? "" : "s"} from
          <span class="text-data">{path?.split(/[\\/]/).pop()}</span> into
          <span class="text-data">{table}</span>.
        </p>
      </div>
    {/if}

    {#if error}
      <!-- -mx-3 pulls the strip's own px-3 back to the modal's gutter. -->
      <div class="-mx-3">
        <ErrorState kind={error.kind} message={error.message} size="inline" />
      </div>
    {/if}
  </div>

  {#snippet footer()}
    <Button variant="text" size="sm" onclick={onclose}>Cancel</Button>
    {#if step > 0}
      <Button variant="outlined" size="sm" onclick={() => (step -= 1)}>Back</Button>
    {/if}
    {#if onLastStep}
      <Button variant="filled" size="sm" disabled={!path || chosen.length === 0} loading={running} onclick={run}>
        Import
      </Button>
    {:else}
      <Button variant="filled" size="sm" disabled={!canAdvance} onclick={() => (step += 1)}>
        Next
      </Button>
    {/if}
  {/snippet}
</Modal>
