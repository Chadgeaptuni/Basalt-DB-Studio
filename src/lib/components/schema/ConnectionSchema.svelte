<script lang="ts">
  import Boxes from "@lucide/svelte/icons/boxes";
  import Table from "@lucide/svelte/icons/table";
  import Eye from "@lucide/svelte/icons/eye";
  import KeyRound from "@lucide/svelte/icons/key-round";
  import TreeItem from "$lib/components/ui/TreeItem.svelte";
  import Spinner from "$lib/components/ui/Spinner.svelte";
  import ErrorState from "$lib/components/ui/ErrorState.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import ContextMenu from "$lib/components/ui/ContextMenu.svelte";
  import type { MenuItem } from "$lib/components/ui/menu";
  import type { RelationKind } from "$lib/api/types";
  import { filterRank, noMatches } from "$lib/utils/filter";
  import { branchIndent } from "./tree";
  import { schema } from "$lib/stores/schema.svelte";
  import { editorTabs } from "$lib/stores/tabs.svelte";
  import { ddl } from "$lib/stores/ddl.svelte";

  // One connection's schema, as the branch under its root row in the tree. The
  // connection owns depth 0, so namespaces start at 1.
  //
  // `activate` runs before anything that reads the *active* session — opening a
  // table tab, any DDL dialog — because the tree shows every connected session at
  // once and the branch you clicked in is not necessarily the one the workspace
  // is pointed at.
  interface Props {
    sessionId: string;
    filter: string;
    kind: "all" | RelationKind;
    activate: () => void;
    /** Depth of this branch's first namespace row. 1 under a connection root; 2
     *  under a Postgres database node, which adds a level above. */
    depth?: number;
  }
  let { sessionId, filter, kind, activate, depth = 1 }: Props = $props();

  const NS_DEPTH = $derived(depth);
  const REL_DEPTH = $derived(depth + 1);
  /** Column rows are not tree items — they indent to where the label one level
   *  below a relation would sit. */
  const COL_INDENT = $derived(branchIndent(depth + 2));

  // ponytail: which namespaces were open is component state, so collapsing the
  // connection forgets it. The cached tree means reopening costs no IPC; lift it
  // to the schema store if the forgetting starts to annoy.
  let expanded = $state<Record<string, boolean>>({});

  // Loads once per session; the store caches the tree, so collapsing and
  // reopening a connection costs no IPC.
  $effect(() => {
    if (!schema.get(sessionId)) void schema.loadTree(sessionId);
  });

  const view = $derived(schema.get(sessionId));

  // Filtering is pure client-side over the cached tree — a keystroke costs no IPC
  // (DESIGN §10). A namespace with no surviving relation drops out entirely, and
  // while a filter is active every namespace is force-expanded, because a match
  // hidden behind a collapsed node is the same as no match.
  const filtering = $derived(filter.trim().length > 0 || kind !== "all");

  const namespaces = $derived.by(() => {
    const tree = view?.tree;
    if (!tree) return [];
    if (!filtering) return tree.namespaces;
    return tree.namespaces
      .map((ns) => ({
        ...ns,
        relations: filterRank(
          kind === "all" ? ns.relations : ns.relations.filter((r) => r.kind === kind),
          filter,
          (r) => r.name,
        ),
      }))
      .filter((ns) => ns.relations.length > 0);
  });

  const matchCount = $derived(namespaces.reduce((n, ns) => n + ns.relations.length, 0));
  const isExpanded = (key: string): boolean => filtering || Boolean(expanded[key]);

  function toggleNs(name: string): void {
    expanded[`ns:${name}`] = !expanded[`ns:${name}`];
  }

  async function toggleTable(ns: string, name: string): Promise<void> {
    const key = `tbl:${ns}:${name}`;
    expanded[key] = !expanded[key];
    if (expanded[key]) await schema.describe(sessionId, ns, name);
  }

  function openTable(ns: string, rel: string): void {
    activate();
    editorTabs.openTable(ns, rel);
  }

  function newTable(namespace: string): void {
    activate();
    ddl.open({ type: "newTable", namespace });
  }

  async function openIndexDialog(ns: string, rel: string): Promise<void> {
    const desc = await schema.describe(sessionId, ns, rel);
    activate();
    ddl.open({
      type: "createIndex",
      namespace: ns,
      table: rel,
      columns: desc?.columns.map((c) => c.name) ?? [],
    });
  }

  function nsMenu(ns: string): MenuItem[] {
    return [{ label: "New table…", onselect: () => newTable(ns) }];
  }

  function relMenu(ns: string, rel: string): MenuItem[] {
    return [
      { label: "Open data", onselect: () => openTable(ns, rel) },
      {
        label: "Add column…",
        onselect: () => {
          activate();
          ddl.open({ type: "addColumn", namespace: ns, table: rel });
        },
      },
      { label: "Create index…", onselect: () => void openIndexDialog(ns, rel) },
      {
        label: "Rename table…",
        onselect: () => {
          activate();
          ddl.open({ type: "renameTable", namespace: ns, table: rel });
        },
      },
      {
        label: "Drop table",
        danger: true,
        onselect: () => {
          activate();
          ddl.preview({ kind: "dropTable", namespace: ns, name: rel });
        },
      },
    ];
  }
</script>

{#if !view || view.loading}
  <div
    class="flex items-center gap-2 py-1 text-body-sm text-on-surface-muted"
    style="padding-left:{COL_INDENT}px"
  >
    <Spinner size="sm" /> Introspecting…
  </div>
{:else if view.error}
  <ErrorState kind={view.error.kind} message={view.error.message} size="inline" filled>
    {#snippet action()}
      <Button variant="text-error" size="sm" onclick={() => schema.loadTree(sessionId)}>Retry</Button>
    {/snippet}
  </ErrorState>
{:else if filtering && matchCount === 0}
  <div class="py-1 text-body-sm text-on-surface-muted" style="padding-left:{COL_INDENT}px">
    {noMatches(filter)}
  </div>
{:else if namespaces.length === 0}
  <div class="py-1 text-body-sm text-on-surface-muted" style="padding-left:{COL_INDENT}px">
    This database is empty.
  </div>
{:else}
  {#each namespaces as ns (ns.name)}
    <ContextMenu items={nsMenu(ns.name)}>
      <TreeItem
        label={ns.name}
        icon={Boxes}
        depth={NS_DEPTH}
        expandable
        expanded={isExpanded(`ns:${ns.name}`)}
        onclick={() => toggleNs(ns.name)}
        ontoggle={() => toggleNs(ns.name)}
      />
    </ContextMenu>
    {#if isExpanded(`ns:${ns.name}`)}
      {#each ns.relations as rel (rel.name)}
        {@const tkey = `tbl:${ns.name}:${rel.name}`}
        <ContextMenu items={relMenu(ns.name, rel.name)}>
          <TreeItem
            label={rel.name}
            icon={rel.kind === "view" ? Eye : Table}
            depth={REL_DEPTH}
            expandable
            expanded={expanded[tkey]}
            title={`${rel.kind} · double-click to open data`}
            onclick={() => toggleTable(ns.name, rel.name)}
            ondblclick={() => openTable(ns.name, rel.name)}
            ontoggle={() => toggleTable(ns.name, rel.name)}
          />
        </ContextMenu>
        {#if expanded[tkey]}
          {@const desc = schema.describeCached(sessionId, ns.name, rel.name)}
          {#if desc}
            {#each desc.columns as col (col.name)}
              <div
                class="flex h-7 items-center gap-1.5 text-data text-on-surface-variant"
                style="padding-left:{COL_INDENT}px"
                title={`${col.typeName}${col.nullable ? " · nullable" : " · not null"}${col.isPk ? " · primary key" : ""}`}
              >
                {#if col.isPk}<KeyRound size={11} class="shrink-0 text-warn" />{/if}
                <span class="truncate">{col.name}</span>
                <span class="truncate text-on-surface-muted">{col.typeName}</span>
              </div>
            {/each}
            {#if desc.columns.length === 0}
              <div class="py-1 text-body-sm text-on-surface-muted" style="padding-left:{COL_INDENT}px">
                No columns
              </div>
            {/if}
          {:else}
            <div
              class="flex items-center gap-2 py-1 text-body-sm text-on-surface-muted"
              style="padding-left:{COL_INDENT}px"
            >
              <Spinner size="sm" /> Loading columns…
            </div>
          {/if}
        {/if}
      {/each}
      {#if ns.relations.length === 0}
        <div class="py-1 text-body-sm text-on-surface-muted" style="padding-left:{COL_INDENT}px">
          No tables
        </div>
      {/if}
    {/if}
  {/each}
{/if}
