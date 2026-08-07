<script lang="ts">
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import IconButton from "$lib/components/ui/IconButton.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import EmptyState from "$lib/components/ui/EmptyState.svelte";
  import ErrorState from "$lib/components/ui/ErrorState.svelte";
  import Panel from "$lib/components/layout/Panel.svelte";
  import { gitsync } from "$lib/stores/gitsync.svelte";

  // The git-sync destination. Sync runs the manual add→commit→pull→push;
  // non-repo / no-git / conflict states render inline guidance rather than a
  // generic error (DESIGN §8).
  $effect(() => void gitsync.refresh());

  const st = $derived(gitsync.status);
  const err = $derived(gitsync.error);
  const canSync = $derived(Boolean(st?.isRepo) && !gitsync.syncing);
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
        message="Git isn't installed."
        hint="Profiles and saved queries sync through the system git — install it and restart Basalt."
      />
    {:else if !st.isRepo}
      <EmptyState
        message="The config dir isn't a git repo."
        hint="Run git init there and add a remote to start syncing."
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

    {#if err}
      <!-- -mx-3 lets the strip span the panel's own padding. Every kind renders,
           including ones sync can't normally produce (DESIGN §8). -->
      <div class="mt-3 -mx-3">
        <ErrorState kind={err.kind} message={err.message} size="inline">
          {#snippet action()}
            <Button size="sm" disabled={!canSync} onclick={() => void gitsync.sync()}>Retry</Button>
          {/snippet}
        </ErrorState>
      </div>
    {/if}
  </div>
</Panel>
