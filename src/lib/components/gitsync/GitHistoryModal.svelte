<script lang="ts">
  import Modal from "$lib/components/ui/Modal.svelte";
  import Badge from "$lib/components/ui/Badge.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Spinner from "$lib/components/ui/Spinner.svelte";
  import EmptyState from "$lib/components/ui/EmptyState.svelte";
  import ErrorState from "$lib/components/ui/ErrorState.svelte";
  import { stateLayerPill, focusRing } from "$lib/components/ui/stateLayer";
  import CommitGraph from "./CommitGraph.svelte";
  import DiffView from "./DiffView.svelte";
  import { gitsyncApi, type Commit, type FileEntry } from "$lib/api/gitsync";
  import type { ApiError } from "$lib/api/client";
  import { buildGraph } from "$lib/utils/commitGraph";

  // The history view: the commit graph on the left, the selected commit's files
  // and diff on the right.
  //
  // A modal rather than an editor tab because history is consulted, not worked
  // in — and because a tab would mean teaching the workspace's tab model about a
  // third kind of thing that has no SQL and no table behind it.
  interface Props {
    onclose: () => void;
  }
  let { onclose }: Props = $props();

  // Enough to see how the config repo has moved without paying for a repo that
  // has been in use for years. The graph is drawn per row, so the cost is linear.
  const LIMIT = 200;

  let commits = $state<Commit[] | null>(null);
  let error = $state<ApiError | null>(null);
  let selected = $state<Commit | null>(null);
  let files = $state<FileEntry[] | null>(null);
  let path = $state<string | null>(null);
  let diff = $state<string | null>(null);

  const rows = $derived(commits ? buildGraph(commits) : []);

  async function load(): Promise<void> {
    error = null;
    try {
      commits = await gitsyncApi.history(LIMIT);
      if (commits.length > 0) await select(commits[0]);
    } catch (e) {
      error = e as ApiError;
    }
  }

  async function select(commit: Commit): Promise<void> {
    selected = commit;
    files = null;
    path = null;
    diff = null;
    try {
      files = await gitsyncApi.commitFiles(commit.hash);
      if (files.length > 0) await openFile(files[0].path);
    } catch (e) {
      error = e as ApiError;
    }
  }

  async function openFile(next: string): Promise<void> {
    if (!selected) return;
    path = next;
    diff = null;
    try {
      diff = await gitsyncApi.commitDiff(selected.hash, next);
    } catch (e) {
      error = e as ApiError;
    }
  }

  $effect(() => {
    void load();
  });

  // Refs come back as git writes them — `HEAD -> main`, `tag: v1`. The prefixes
  // are noise once they are rendered as chips beside the subject.
  const refLabel = (ref: string): string => ref.replace(/^HEAD -> /, "").replace(/^tag: /, "");

  const when = (iso: string): string =>
    new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
</script>

<Modal open title="History" size="4xl" {onclose}>
  <div class="flex h-[min(34rem,70vh)] gap-0 overflow-hidden">
    <!-- Left: the graph. Fixed width so the diff beside it keeps a stable
         measure as commit subjects change length. -->
    <div class="w-96 shrink-0 overflow-auto border-r border-outline-variant">
      {#if error && !commits}
        <ErrorState kind={error.kind} message={error.message}>
          {#snippet action()}
            <Button size="sm" onclick={() => void load()}>Retry</Button>
          {/snippet}
        </ErrorState>
      {:else if commits === null}
        <div class="flex items-center gap-2 p-3 text-body-md text-on-surface-muted">
          <Spinner size="sm" /> Loading…
        </div>
      {:else if commits.length === 0}
        <div class="p-3">
          <EmptyState
            message="No commits yet."
            hint="Commit from the Git panel and the history will start here."
          />
        </div>
      {:else}
        {#each rows as row (row.commit.hash)}
          <button
            type="button"
            onclick={() => void select(row.commit)}
            aria-current={selected?.hash === row.commit.hash ? true : undefined}
            class="flex h-9 w-full items-center gap-2 pr-2 text-left {stateLayerPill} {focusRing}
              {selected?.hash === row.commit.hash ? 'bg-surface-container-high' : ''}"
          >
            <CommitGraph {row} {rows} selected={selected?.hash === row.commit.hash} />
            <span class="min-w-0 flex-1 truncate text-body-sm text-on-surface-variant">
              {row.commit.subject}
            </span>
            {#each row.commit.refs as ref (ref)}
              <Badge variant={ref.startsWith("HEAD") ? "primary" : "neutral"}>
                {refLabel(ref)}
              </Badge>
            {/each}
            <span class="shrink-0 text-data text-on-surface-muted">{row.commit.short}</span>
          </button>
        {/each}
      {/if}
    </div>

    <!-- Right: what the selected commit did. -->
    <div class="flex min-w-0 flex-1 flex-col overflow-hidden">
      {#if selected}
        <div class="shrink-0 border-b border-outline-variant p-3">
          <p class="text-body-md text-on-surface">{selected.subject}</p>
          <p class="mt-0.5 text-body-sm text-on-surface-muted">
            {selected.author} · {when(selected.date)} ·
            <span class="text-data">{selected.short}</span>
            {#if selected.parents.length > 1}· merge{/if}
          </p>
        </div>

        {#if files === null}
          <div class="flex items-center gap-2 p-3 text-body-md text-on-surface-muted">
            <Spinner size="sm" /> Loading…
          </div>
        {:else if files.length === 0}
          <div class="p-3">
            <EmptyState message="This commit changed no files." />
          </div>
        {:else}
          <!-- File strip over the diff, rather than a third column: a config repo
               commit touches one or two files, and a column for that is mostly
               empty space taken from the diff. -->
          <div class="flex shrink-0 gap-1 overflow-x-auto border-b border-outline-variant p-1">
            {#each files as file (file.path)}
              <button
                type="button"
                onclick={() => void openFile(file.path)}
                class="shrink-0 rounded-full px-2 py-1 text-data whitespace-nowrap {focusRing}
                  {path === file.path
                  ? 'bg-secondary-container text-on-secondary-container'
                  : 'text-on-surface-muted'}"
              >
                {file.path}
              </button>
            {/each}
          </div>

          <div class="min-h-0 flex-1 overflow-auto">
            {#if diff === null}
              <div class="flex items-center gap-2 p-3 text-body-md text-on-surface-muted">
                <Spinner size="sm" /> Loading…
              </div>
            {:else}
              <DiffView raw={diff} />
            {/if}
          </div>
        {/if}
      {:else if commits !== null && commits.length > 0}
        <div class="p-3">
          <EmptyState message="Select a commit to see what it changed." />
        </div>
      {/if}
    </div>
  </div>
</Modal>
