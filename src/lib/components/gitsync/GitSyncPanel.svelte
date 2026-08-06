<script lang="ts">
  import GitBranch from "@lucide/svelte/icons/git-branch";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";
  import IconButton from "$lib/components/ui/IconButton.svelte";
  import EmptyState from "$lib/components/ui/EmptyState.svelte";
  import Panel from "$lib/components/layout/Panel.svelte";
  import { gitsync } from "$lib/stores/gitsync.svelte";

  // The git-sync destination. Sync runs the manual add→commit→pull→push;
  // non-repo / no-git / conflict states render inline guidance rather than a
  // generic error (DESIGN §8).
  $effect(() => void gitsync.refresh());

  const st = $derived(gitsync.status);
  const err = $derived(gitsync.error);
  const canSync = $derived(Boolean(st?.isRepo) && !gitsync.syncing);

  // gitConflict / gitDirty / internal message shown inline; others fall through.
  const errText = $derived(
    err?.kind === "gitConflict" || err?.kind === "gitDirty" || err?.kind === "internal"
      ? err.message
      : null,
  );
</script>

<Panel title="Git">
  {#snippet actions()}
    <IconButton
      icon={RefreshCw}
      title="Sync (commit · pull · push)"
      size="sm"
      loading={gitsync.syncing}
      disabled={!canSync}
      onclick={() => void gitsync.sync()}
    />
  {/snippet}

  <div class="flex-1 overflow-auto p-3 text-data text-on-surface-muted">
    {#if !st || !st.installed}
      <EmptyState
        icon={GitBranch}
        message="Git isn't installed, so profiles and saved queries can't sync."
      />
    {:else if !st.isRepo}
      <EmptyState
        icon={GitBranch}
        message="The config dir isn't a git repo. Init one and add a remote to sync."
      />
    {:else}
      <dl class="flex flex-col gap-2">
        <div class="flex items-baseline gap-2">
          <dt class="text-label-sm text-on-surface-muted uppercase">Branch</dt>
          <dd class="min-w-0 truncate text-on-surface-variant">{st.branch ?? "—"}</dd>
        </div>
        <div class="flex items-baseline gap-3">
          <dt class="text-label-sm text-on-surface-muted uppercase">State</dt>
          <dd class="flex items-baseline gap-3 tabular-nums">
            {#if st.dirty > 0}<span class="text-warn">●{st.dirty} uncommitted</span>{/if}
            {#if st.ahead > 0}<span>↑{st.ahead} ahead</span>{/if}
            {#if st.behind > 0}<span>↓{st.behind} behind</span>{/if}
            {#if st.dirty === 0 && st.ahead === 0 && st.behind === 0}
              <span class="text-ok">in sync</span>
            {/if}
          </dd>
        </div>
        {#if !st.hasRemote}
          <div class="text-on-surface-muted">No remote configured — sync is local only.</div>
        {/if}
      </dl>
    {/if}

    {#if errText}
      <div class="mt-3 flex items-start gap-1.5 whitespace-pre-wrap text-error">
        <TriangleAlert size={14} strokeWidth={2} class="mt-0.5 shrink-0" />
        <span>{errText}</span>
      </div>
    {/if}
  </div>
</Panel>
