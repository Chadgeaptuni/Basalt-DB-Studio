<script lang="ts">
  import GitBranch from "@lucide/svelte/icons/git-branch";
  import History from "@lucide/svelte/icons/history";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import ArrowDown from "@lucide/svelte/icons/arrow-down";
  import ArrowUp from "@lucide/svelte/icons/arrow-up";
  import Download from "@lucide/svelte/icons/download";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import Panel from "$lib/components/layout/Panel.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import IconButton from "$lib/components/ui/IconButton.svelte";
  import DropdownMenu from "$lib/components/ui/DropdownMenu.svelte";
  import EmptyState from "$lib/components/ui/EmptyState.svelte";
  import ErrorState from "$lib/components/ui/ErrorState.svelte";
  import PromptDialog from "$lib/components/ui/PromptDialog.svelte";
  import { stateLayer, focusRing } from "$lib/components/ui/stateLayer";
  import type { MenuItem } from "$lib/components/ui/menu";
  import GitFileRow from "./GitFileRow.svelte";
  import GitHistoryModal from "./GitHistoryModal.svelte";
  import GitDiffModal from "./GitDiffModal.svelte";
  import { gitsync } from "$lib/stores/gitsync.svelte";
  import { confirm } from "$lib/stores/dialogs.svelte";
  import type { FileEntry } from "$lib/api/gitsync";

  // The git destination: a source-control panel over the config repo (profiles +
  // saved queries). Everything is scoped to that one repo — Basalt is a database
  // tool that syncs its own config through git, not a git client that happens to
  // be inside one.
  //
  // Credentials are never asked for here. The system's git holds them (see
  // `api/gitsync.ts`), so a remote that refuses arrives as `gitAuthFailed` and
  // renders as guidance toward the credential helper rather than a login form
  // this app has nowhere to store the result of.
  $effect(() => void gitsync.refresh());

  let message = $state("");
  let showHistory = $state(false);
  let prompt = $state<"branch" | "remote" | null>(null);
  let diffing = $state<{ path: string; staged: boolean } | null>(null);

  const st = $derived(gitsync.status);
  const busy = $derived(gitsync.working);
  const canCommit = $derived(
    Boolean(st?.staged.length) && message.trim().length > 0 && !busy,
  );

  const branchMenu = $derived<MenuItem[]>([
    ...gitsync.branches
      .filter((b) => !b.remote)
      .map((b) => ({
        label: b.name,
        checked: b.current,
        onselect: () => void gitsync.checkout(b.name),
      })),
    { label: "New branch…", onselect: () => (prompt = "branch") },
  ]);

  async function commit(): Promise<void> {
    if (await gitsync.commit(message.trim())) message = "";
  }

  // Discarding is the one action here git cannot undo — there is no reflog entry
  // for a working-tree change that was never committed. It names the file, per
  // DESIGN §7's rule against a bare "Are you sure?".
  async function discard(entry: FileEntry): Promise<void> {
    const ok = await confirm({
      title: `Discard changes to ${entry.path}?`,
      message:
        entry.state === "untracked"
          ? "This deletes the file. Git has no copy of it, so it cannot be recovered."
          : "This reverts the file to the last commit. The current contents are not recoverable.",
      confirmLabel: "Discard",
      variant: "danger",
    });
    if (ok) await gitsync.discard([entry.path]);
  }
</script>

{#snippet section(title: string, entries: FileEntry[], staged: boolean)}
  {#if entries.length > 0}
    <div class="flex shrink-0 items-center gap-2 px-3 pt-3 pb-1">
      <h3 class="text-label-sm tracking-wider text-on-surface-muted uppercase">{title}</h3>
      <span class="text-data text-on-surface-muted tabular-nums">{entries.length}</span>
      <span class="h-px flex-1 bg-outline-variant"></span>
      <button
        type="button"
        disabled={busy}
        onclick={() =>
          void (staged
            ? gitsync.unstage(entries.map((e) => e.path))
            : gitsync.stage(entries.map((e) => e.path)))}
        class="rounded-xs px-1 text-label-sm text-on-surface-muted disabled:opacity-[0.38]
          {stateLayer} {focusRing}"
      >
        {staged ? "Unstage all" : "Stage all"}
      </button>
    </div>
    {#each entries as entry (entry.path)}
      <GitFileRow
        {entry}
        {staged}
        {busy}
        selected={diffing?.path === entry.path && diffing.staged === staged}
        onselect={() => (diffing = { path: entry.path, staged })}
        ontoggle={() =>
          void (staged ? gitsync.unstage([entry.path]) : gitsync.stage([entry.path]))}
        ondiscard={() => void discard(entry)}
      />
    {/each}
  {/if}
{/snippet}

<Panel title="Git">
  {#snippet actions()}
    <IconButton
      icon={History}
      title="History"
      size="sm"
      disabled={!st?.isRepo}
      onclick={() => (showHistory = true)}
    />
    <IconButton
      icon={RefreshCw}
      title="Refresh"
      size="sm"
      loading={gitsync.busy === "fetch"}
      disabled={busy}
      onclick={() => void (st?.hasRemote ? gitsync.fetch() : gitsync.refresh())}
    />
  {/snippet}

  {#if !st || !st.installed}
    <div class="p-3">
      <EmptyState
        message="Git isn't installed."
        hint="Profiles and saved queries sync through the system git — install it and restart Basalt."
      />
    </div>
  {:else if !st.isRepo}
    <div class="flex flex-col items-center gap-3 p-3">
      <EmptyState
        message="The config directory isn't a git repository yet."
        hint="Make it one to keep a history of your profiles and saved queries, and to share them with a team."
      />
      <Button variant="filled" size="sm" disabled={busy} onclick={() => void gitsync.init()}>
        Initialize repository
      </Button>
    </div>
  {:else}
    <!-- Branch bar: what you are on, how far from the remote, and the three
         actions that move between them. -->
    <div class="flex h-9 shrink-0 items-center gap-1 border-b border-outline-variant px-1">
      <DropdownMenu
        items={branchMenu}
        label="Switch branch"
        triggerClass="flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-full px-2 text-data
          text-on-surface-variant {stateLayer} {focusRing}"
      >
        <GitBranch size={13} strokeWidth={2} class="shrink-0 text-on-surface-muted" />
        <span class="min-w-0 flex-1 truncate text-left">{st.branch ?? "detached"}</span>
        <ChevronDown size={12} class="shrink-0 text-on-surface-muted" />
      </DropdownMenu>

      {#if st.behind > 0}
        <span class="shrink-0 px-1 text-data text-on-surface-muted tabular-nums">↓{st.behind}</span>
      {/if}
      {#if st.ahead > 0}
        <span class="shrink-0 px-1 text-data text-on-surface-muted tabular-nums">↑{st.ahead}</span>
      {/if}

      {#if st.hasRemote}
        <IconButton
          icon={ArrowDown}
          title="Pull (rebase)"
          size="sm"
          loading={gitsync.busy === "pull"}
          disabled={busy}
          onclick={() => void gitsync.pull()}
        />
        <IconButton
          icon={ArrowUp}
          title="Push"
          size="sm"
          loading={gitsync.busy === "push"}
          disabled={busy}
          onclick={() => void gitsync.push()}
        />
      {:else}
        <IconButton
          icon={Download}
          title="Add a remote"
          size="sm"
          disabled={busy}
          onclick={() => (prompt = "remote")}
        />
      {/if}
    </div>

    <div class="min-h-0 flex-1 overflow-auto">
      {#if st.inProgress}
        <ErrorState
          kind="gitDirty"
          message="A rebase or merge is half-finished in the config repo."
          size="inline"
        />
      {/if}

      <!-- Conflicts first and unstageable: resolving one is text editing, and the
           honest thing is to say so rather than offer buttons that cannot finish
           the job. -->
      {@render section("Conflicts", st.conflicted, false)}
      {@render section("Staged", st.staged, true)}
      {@render section("Changes", st.unstaged, false)}

      {#if !st.inProgress && st.staged.length + st.unstaged.length + st.conflicted.length === 0}
        <div class="p-3">
          <EmptyState
            message="Nothing to commit."
            hint={st.hasRemote
              ? "Profiles and saved queries you change will show up here."
              : "No remote yet — add one to share this with a team."}
          />
        </div>
      {/if}

      {#if gitsync.error}
        <div class="mt-2">
          <ErrorState kind={gitsync.error.kind} message={gitsync.error.message} size="inline">
            {#snippet action()}
              <Button size="sm" onclick={gitsync.clearError}>Dismiss</Button>
            {/snippet}
          </ErrorState>
        </div>
      {/if}
    </div>

    <!-- Commit box pinned to the foot, the way every source-control panel does
         it: the message is the last thing you write and the button is where the
         hand already is. -->
    <div class="flex shrink-0 flex-col gap-2 border-t border-outline-variant p-2">
      <Input
        label="Commit message"
        bind:value={message}
        placeholder="Message"
        disabled={busy}
        onkeydown={(e) => e.key === "Enter" && canCommit && void commit()}
      />
      <div class="flex items-center gap-2">
        <div class="flex-1">
          <Button variant="filled" size="sm" disabled={!canCommit} onclick={() => void commit()}>
            Commit {st.staged.length > 0 ? `(${st.staged.length})` : ""}
          </Button>
        </div>
        <Button
          variant="tonal"
          size="sm"
          disabled={busy}
          onclick={() => void gitsync.sync()}
          title="Stage everything, commit, pull and push"
        >
          Sync
        </Button>
      </div>
    </div>
  {/if}
</Panel>

{#if showHistory}
  <GitHistoryModal onclose={() => (showHistory = false)} />
{/if}

{#if diffing}
  <GitDiffModal
    path={diffing.path}
    staged={diffing.staged}
    onclose={() => (diffing = null)}
  />
{/if}

{#if prompt === "branch"}
  <PromptDialog
    title="New branch"
    label="Name"
    hint="Created from the current branch and checked out."
    placeholder="feature/new-profiles"
    confirmLabel="Create"
    onsubmit={(name) => void gitsync.createBranch(name)}
    onclose={() => (prompt = null)}
  />
{:else if prompt === "remote"}
  <PromptDialog
    title="Add a remote"
    label="Origin URL"
    hint="An SSH or HTTPS URL. Basalt never stores credentials for it — your system git does."
    placeholder="git@github.com:you/basalt-config.git"
    confirmLabel="Add"
    onsubmit={(url) => void gitsync.setRemote(url)}
    onclose={() => (prompt = null)}
  />
{/if}
