<script lang="ts">
  import Modal from "$lib/components/ui/Modal.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Spinner from "$lib/components/ui/Spinner.svelte";
  import ErrorState from "$lib/components/ui/ErrorState.svelte";
  import DiffView from "./DiffView.svelte";
  import { gitsyncApi } from "$lib/api/gitsync";
  import type { ApiError } from "$lib/api/client";

  // One working-tree file's diff. A modal rather than a pane inside the panel:
  // at 280px a diff wraps into unreadability, and the panel's job is the file
  // *list*.
  interface Props {
    path: string;
    /** Staged shows HEAD→index; unstaged shows index→disk. */
    staged: boolean;
    onclose: () => void;
  }
  let { path, staged, onclose }: Props = $props();

  let raw = $state<string | null>(null);
  let error = $state<ApiError | null>(null);

  async function load(): Promise<void> {
    error = null;
    try {
      raw = await gitsyncApi.fileDiff(path, staged);
    } catch (e) {
      error = e as ApiError;
    }
  }

  $effect(() => {
    void load();
  });
</script>

<Modal open title={path} size="3xl" {onclose}>
  {#if error}
    <ErrorState kind={error.kind} message={error.message}>
      {#snippet action()}
        <Button size="sm" onclick={() => void load()}>Retry</Button>
      {/snippet}
    </ErrorState>
  {:else if raw === null}
    <div class="flex items-center gap-2 p-3 text-body-md text-on-surface-muted">
      <Spinner size="sm" /> Loading…
    </div>
  {:else}
    <DiffView {raw} />
  {/if}
</Modal>
