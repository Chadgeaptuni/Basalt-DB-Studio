<script lang="ts">
  import { open } from "@tauri-apps/plugin-dialog";
  import { untrack } from "svelte";
  import FileText from "@lucide/svelte/icons/file-text";
  import Modal from "$lib/components/ui/Modal.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Checkbox from "$lib/components/ui/Checkbox.svelte";
  import Select from "$lib/components/ui/Select.svelte";
  import { ioApi } from "$lib/api/io";
  import { connections } from "$lib/stores/connections.svelte";
  import { toast } from "$lib/stores/toasts.svelte";
  import type { ConflictMode } from "$lib/api/types";
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
  let error = $state<string | null>(null);

  const chosen = $derived(columns.filter((c) => picked[c]));
  const conflictOptions = [
    { value: "insert", label: "Insert (fail on conflict)" },
    { value: "skip", label: "Skip duplicates" },
    { value: "upsert", label: "Upsert (update on conflict)" },
  ];

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
      const detail = err.detail as { line?: number } | undefined;
      error = detail?.line ? `Line ${detail.line}: ${err.message}` : err.message;
    } finally {
      running = false;
    }
  }
</script>

<Modal open title={`Import CSV into ${table}`} size="lg" {onclose}>
  <div class="flex flex-col gap-3">
    <div class="flex items-center gap-2">
      <Button variant="secondary" size="sm" onclick={browse}><FileText size={13} strokeWidth={2} /> Choose CSV…</Button>
      <span class="truncate font-mono text-xs text-on-surface-muted">{path ?? "No file selected"}</span>
    </div>

    <label class="flex flex-col gap-1">
      <span class="text-xs tracking-wider text-on-surface-muted uppercase">Conflict mode</span>
      <Select bind:value={conflict} options={conflictOptions} />
    </label>

    <Checkbox bind:checked={hasHeader} label="First row is a header" />

    <div class="flex flex-col gap-1">
      <span class="text-xs tracking-wider text-on-surface-muted uppercase">Target columns (in CSV order)</span>
      <div class="flex max-h-40 flex-col gap-1 overflow-auto rounded-md border border-outline-variant bg-surface p-2">
        {#each columns as col (col)}
          <Checkbox bind:checked={picked[col]} label={col} />
        {/each}
      </div>
    </div>

    {#if error}
      <p class="font-mono text-xs whitespace-pre-wrap text-error">{error}</p>
    {/if}
  </div>

  {#snippet footer()}
    <Button variant="ghost" size="sm" onclick={onclose}>Cancel</Button>
    <Button variant="primary" size="sm" disabled={!path || chosen.length === 0} loading={running} onclick={run}>
      Import
    </Button>
  {/snippet}
</Modal>
