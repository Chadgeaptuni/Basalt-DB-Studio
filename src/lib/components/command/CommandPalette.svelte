<script lang="ts">
  import Table from "@lucide/svelte/icons/table";
  import Eye from "@lucide/svelte/icons/eye";
  import FileCode from "@lucide/svelte/icons/file-code";
  import Database from "@lucide/svelte/icons/database";
  import Sun from "@lucide/svelte/icons/sun";
  import Moon from "@lucide/svelte/icons/moon";
  import type { IconComponent } from "$lib/components/ui/icon";
  import Modal from "$lib/components/ui/Modal.svelte";
  import SearchField from "$lib/components/ui/SearchField.svelte";
  import ListItem from "$lib/components/ui/ListItem.svelte";
  import EmptyState from "$lib/components/ui/EmptyState.svelte";
  import { DESTINATIONS } from "$lib/components/layout/destinations";
  import { connections } from "$lib/stores/connections.svelte";
  import { schema } from "$lib/stores/schema.svelte";
  import { savedQueries } from "$lib/stores/savedQueries.svelte";
  import { editorTabs } from "$lib/stores/tabs.svelte";
  import { panel } from "$lib/stores/panel.svelte";
  import { theme } from "$lib/stores/theme.svelte";
  import { toast } from "$lib/stores/toasts.svelte";
  import { filterRank, noMatches } from "$lib/utils/filter";

  // The single global search surface (DESIGN §6/§7): tables, saved queries,
  // connections and actions in one ranked list.
  //
  // Everything is read from stores already in memory — the schema tree, the saved
  // query index, the connection profiles — so typing costs zero IPC (DESIGN §10).
  // The one exception is *running* a saved query, which reads its file on select.
  interface Props {
    onclose: () => void;
  }
  let { onclose }: Props = $props();

  interface CommandItem {
    id: string;
    label: string;
    detail?: string;
    group: string;
    icon: IconComponent;
    run: () => void | Promise<void>;
  }

  // Results are ranked globally rather than grouped: when you type, the best match
  // should be first whatever kind it is. The group rides along as a trailing label.
  const MAX_RESULTS = 50;

  const actions = $derived<CommandItem[]>([
    ...DESTINATIONS.map((d) => ({
      id: `go:${d.id}`,
      label: `Go to ${d.label}`,
      group: "Action",
      icon: d.icon,
      run: () => panel.select(d.id),
    })),
    {
      id: "act:new-tab",
      label: "New editor tab",
      group: "Action",
      icon: FileCode,
      run: () => editorTabs.open(),
    },
    {
      id: "act:appearance",
      label: theme.isLight ? "Switch to dark" : "Switch to light",
      group: "Action",
      icon: theme.isLight ? Moon : Sun,
      run: theme.toggleAppearance,
    },
  ]);

  const tables = $derived.by<CommandItem[]>(() => {
    const sess = connections.active;
    const tree = sess ? schema.get(sess.sessionId)?.tree : undefined;
    if (!tree) return [];
    return tree.namespaces.flatMap((ns) =>
      ns.relations.map((rel) => ({
        id: `tbl:${ns.name}.${rel.name}`,
        label: rel.name,
        detail: ns.name,
        group: rel.kind === "view" ? "View" : "Table",
        icon: rel.kind === "view" ? Eye : Table,
        run: () => {
          editorTabs.openTable(ns.name, rel.name);
        },
      })),
    );
  });

  const queries = $derived<CommandItem[]>(
    savedQueries.items.map((q) => ({
      id: `qry:${q.path}`,
      label: q.name,
      detail: q.path,
      group: "Query",
      icon: FileCode,
      run: async () => {
        try {
          const sql = await savedQueries.read(q.path);
          editorTabs.openSaved(q.path, q.name, sql);
        } catch (e) {
          toast.fromError(e, "Couldn't open the query");
        }
      },
    })),
  );

  const profiles = $derived<CommandItem[]>(
    connections.profiles.map((p) => ({
      id: `con:${p.id}`,
      label: p.name,
      detail: p.engine === "sqlite" ? (p.filePath ?? "") : `${p.host ?? ""}${p.port ? `:${p.port}` : ""}`,
      group: "Connection",
      icon: Database,
      run: () => void connections.activate(p.id),
    })),
  );

  let query = $state("");
  let selected = $state(0);

  const all = $derived([...actions, ...tables, ...queries, ...profiles]);
  const ranked = $derived(filterRank(all, query, (i) => `${i.label} ${i.detail ?? ""}`));
  const results = $derived(ranked.slice(0, MAX_RESULTS));
  const hidden = $derived(ranked.length - results.length);

  // Reading `query` is the dependency, not a no-op: a new search must restart the
  // highlight, or Enter fires whatever happened to sit at the old index.
  $effect(() => {
    query;
    selected = 0;
  });

  function choose(item: CommandItem): void {
    void item.run();
    onclose();
  }

  function onKeydown(e: KeyboardEvent): void {
    if (results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      selected = (selected + 1) % results.length;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selected = (selected - 1 + results.length) % results.length;
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(results[selected]);
    }
  }
</script>

<Modal open title="Search" size="xl" headerHidden padding={false} {onclose}>
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="shrink-0 border-b border-outline-variant p-3">
      <SearchField
        bind:value={query}
        label="Search tables, queries, connections and actions"
        placeholder="Search tables, queries, connections and actions…"
        autofocus
        onkeydown={onKeydown}
      />
    </div>

    {#if results.length === 0}
      {#if query}
        <EmptyState message={noMatches(query)} hint="Matching is by subsequence, so try fewer letters." />
      {:else}
        <EmptyState
          message="Nothing to search yet."
          hint="Connect to a database and its tables show up here."
        />
      {/if}
    {:else}
      <div class="min-h-0 flex-1 overflow-auto py-1" role="listbox" aria-label="Results">
        {#each results as item, i (item.id)}
          <div role="option" aria-selected={i === selected}>
            <ListItem
              headline={item.label}
              supporting={item.detail}
              icon={item.icon}
              selected={i === selected}
              mono={item.group !== "Action"}
              onclick={() => choose(item)}
            >
              {#snippet trailing()}
                <span class="text-label-sm text-on-surface-muted">{item.group}</span>
              {/snippet}
            </ListItem>
          </div>
        {/each}
        {#if hidden > 0}
          <p class="px-3 py-2 text-label-sm text-on-surface-muted">
            {hidden} more — keep typing to narrow.
          </p>
        {/if}
      </div>
    {/if}
  </div>
</Modal>
