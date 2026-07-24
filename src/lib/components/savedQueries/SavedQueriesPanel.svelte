<script lang="ts">
  import BookMarked from "@lucide/svelte/icons/bookmark";
  import FileCode from "@lucide/svelte/icons/file-code";
  import Folder from "@lucide/svelte/icons/folder";
  import Save from "@lucide/svelte/icons/save";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import TreeItem from "$lib/components/ui/TreeItem.svelte";
  import Spinner from "$lib/components/ui/Spinner.svelte";
  import EmptyState from "$lib/components/ui/EmptyState.svelte";
  import IconButton from "$lib/components/ui/IconButton.svelte";
  import AccordionSection from "$lib/components/ui/AccordionSection.svelte";
  import ContextMenu, { type MenuItem } from "$lib/components/ui/ContextMenu.svelte";
  import { savedQueries } from "$lib/stores/savedQueries.svelte";
  import { saveQuery } from "$lib/stores/saveQuery.svelte";
  import { editorTabs } from "$lib/stores/tabs.svelte";
  import { confirm } from "$lib/stores/dialogs.svelte";
  import { toast } from "$lib/stores/toasts.svelte";
  import type { SavedQuery } from "$lib/api/savedQueries";
  import type { ApiError } from "$lib/api/client";

  let menu = $state<{ x: number; y: number; items: MenuItem[] } | null>(null);

  $effect(() => void savedQueries.load());

  // Group by folder (the path minus its last segment); root ("") first, then
  // folders alphabetically. Deeper nesting collapses to a full-path header — v1.
  const groups = $derived.by(() => {
    const by = new Map<string, SavedQuery[]>();
    for (const q of savedQueries.items) {
      const slash = q.path.lastIndexOf("/");
      const folder = slash === -1 ? "" : q.path.slice(0, slash);
      (by.get(folder) ?? by.set(folder, []).get(folder)!).push(q);
    }
    return [...by.entries()]
      .sort(([a], [b]) => (a === "" ? -1 : b === "" ? 1 : a.localeCompare(b)))
      .map(([folder, queries]) => ({ folder, queries }));
  });

  async function open(q: SavedQuery): Promise<void> {
    try {
      const sql = await savedQueries.read(q.path);
      editorTabs.openSaved(q.path, q.name, sql);
    } catch (e) {
      toast.error((e as ApiError).message);
    }
  }

  async function remove(q: SavedQuery): Promise<void> {
    const ok = await confirm({
      title: "Delete saved query?",
      message: `${q.path} will be removed from the config dir.`,
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (ok) await savedQueries.remove(q.path);
  }

  function rowMenu(e: MouseEvent, q: SavedQuery): void {
    menu = {
      x: e.clientX,
      y: e.clientY,
      items: [
        { label: "Open", onselect: () => void open(q) },
        { label: "Delete", danger: true, onselect: () => void remove(q) },
      ],
    };
  }
</script>

<AccordionSection id="saved" title="Saved">
  {#snippet actions()}
    <IconButton icon={Save} title="Save current query" size="sm" onclick={() => void saveQuery.trigger()} />
    <IconButton icon={RefreshCw} title="Refresh" size="sm" onclick={() => void savedQueries.load()} />
  {/snippet}

  <div class="flex-1 overflow-auto py-1">
    {#if savedQueries.loading && savedQueries.items.length === 0}
      <div class="flex items-center gap-2 p-3 text-sm text-fg-2"><Spinner size="sm" /> Loading…</div>
    {:else if savedQueries.error}
      <div class="p-3 text-xs whitespace-pre-wrap text-danger">{savedQueries.error.message}</div>
    {:else if savedQueries.items.length === 0}
      <EmptyState icon={BookMarked} message="No saved queries. Save one with Ctrl+S." />
    {:else}
      <div role="tree">
        {#each groups as g (g.folder)}
          {#if g.folder}
            <TreeItem label={g.folder} icon={Folder} depth={0} />
          {/if}
          {#each g.queries as q (q.path)}
            <TreeItem
              label={q.name}
              icon={FileCode}
              depth={g.folder ? 1 : 0}
              title={q.path}
              onclick={() => void open(q)}
              oncontextmenu={(e) => rowMenu(e, q)}
            />
          {/each}
        {/each}
      </div>
    {/if}
  </div>
</AccordionSection>

{#if menu}
  <ContextMenu x={menu.x} y={menu.y} items={menu.items} onclose={() => (menu = null)} />
{/if}
