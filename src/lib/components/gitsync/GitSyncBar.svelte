<script lang="ts">
  import GitBranch from "@lucide/svelte/icons/git-branch";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";
  import IconButton from "$lib/components/ui/IconButton.svelte";
  import { gitsync } from "$lib/stores/gitsync.svelte";

  // Sidebar sync bar (DESIGN §5 density). The badge shows branch + dirty/ahead/
  // behind; Sync runs the manual add→commit→pull→push. Non-repo / no-git / conflict
  // states render inline guidance instead of a generic error.
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

<div class="shrink-0 border-t border-outline-variant bg-surface-container px-2 py-1 text-data text-on-surface-muted">
  <div class="flex h-8 items-center gap-1.5">
    <GitBranch size={12} strokeWidth={2} class="shrink-0" />
    {#if !st || !st.installed}
      <span class="truncate text-on-surface-muted">git not installed</span>
    {:else if !st.isRepo}
      <span class="truncate" title="Make the config dir a git repo and add a remote to sync">
        not a git repo
      </span>
    {:else}
      <span class="truncate text-on-surface-variant">{st.branch ?? "—"}</span>
      {#if st.dirty > 0}<span class="text-warn tabular-nums">●{st.dirty}</span>{/if}
      {#if st.ahead > 0}<span class="tabular-nums">↑{st.ahead}</span>{/if}
      {#if st.behind > 0}<span class="tabular-nums">↓{st.behind}</span>{/if}
      {#if !st.hasRemote}<span class="text-on-surface-muted">· no remote</span>{/if}
    {/if}
    <div class="flex-1"></div>
    <IconButton
      icon={RefreshCw}
      title="Sync (commit · pull · push)"
      size="sm"
      loading={gitsync.syncing}
      disabled={!canSync}
      onclick={() => void gitsync.sync()}
    />
  </div>

  {#if errText}
    <div class="mt-0.5 flex items-start gap-1 whitespace-pre-wrap text-error">
      <TriangleAlert size={11} strokeWidth={2} class="mt-0.5 shrink-0" />
      <span>{errText}</span>
    </div>
  {/if}
</div>
