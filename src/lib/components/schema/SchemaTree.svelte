<script lang="ts">
  import Boxes from "@lucide/svelte/icons/boxes";
  import Table from "@lucide/svelte/icons/table";
  import Eye from "@lucide/svelte/icons/eye";
  import KeyRound from "@lucide/svelte/icons/key-round";
  import Plus from "@lucide/svelte/icons/plus";
  import TreeItem from "$lib/components/ui/TreeItem.svelte";
  import Spinner from "$lib/components/ui/Spinner.svelte";
  import EmptyState from "$lib/components/ui/EmptyState.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import IconButton from "$lib/components/ui/IconButton.svelte";
  import Panel from "$lib/components/layout/Panel.svelte";
  import SearchField from "$lib/components/ui/SearchField.svelte";
  import SegmentedButton, { type Segment } from "$lib/components/ui/SegmentedButton.svelte";
  import ContextMenu from "$lib/components/ui/ContextMenu.svelte";
  import type { MenuItem } from "$lib/components/ui/menu";
  import { filterRank } from "$lib/utils/filter";
  import { connections } from "$lib/stores/connections.svelte";
  import { schema } from "$lib/stores/schema.svelte";
  import { editorTabs } from "$lib/stores/tabs.svelte";
  import { ddl } from "$lib/stores/ddl.svelte";

  const sessionId = $derived(connections.active?.sessionId ?? null);
  let expanded = $state<Record<string, boolean>>({});

  const KIND_SEGMENTS: Segment[] = [
    { value: "all", label: "All" },
    { value: "table", label: "Tables" },
    { value: "view", label: "Views" },
  ];

  function newTable(namespace: string): void {
    ddl.open({ type: "newTable", namespace });
  }

  async function openIndexDialog(ns: string, rel: string): Promise<void> {
    const id = sessionId;
    const desc = id ? await schema.describe(id, ns, rel) : null;
    ddl.open({ type: "createIndex", namespace: ns, table: rel, columns: desc?.columns.map((c) => c.name) ?? [] });
  }

  function nsMenu(ns: string): MenuItem[] {
    return [{ label: "New table…", onselect: () => newTable(ns) }];
  }

  function relMenu(ns: string, rel: string): MenuItem[] {
    return [
      { label: "Open data", onselect: () => editorTabs.openTable(ns, rel) },
      { label: "Add column…", onselect: () => ddl.open({ type: "addColumn", namespace: ns, table: rel }) },
      { label: "Create index…", onselect: () => void openIndexDialog(ns, rel) },
      { label: "Rename table…", onselect: () => ddl.open({ type: "renameTable", namespace: ns, table: rel }) },
      { label: "Drop table", danger: true, onselect: () => ddl.preview({ kind: "dropTable", namespace: ns, name: rel }) },
    ];
  }

  // Load the tree the first time a session becomes active.
  $effect(() => {
    const id = sessionId;
    if (id && !schema.get(id)) void schema.loadTree(id);
  });

  const view = $derived(sessionId ? schema.get(sessionId) : undefined);

  // Filtering is pure client-side over the cached tree — a keystroke costs no IPC
  // (DESIGN §10). A namespace with no surviving relation drops out entirely, and
  // while a filter is active every namespace is force-expanded, because a match
  // hidden behind a collapsed node is the same as no match.
  let filter = $state("");
  let kind = $state<"all" | "table" | "view">("all");
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
    if (expanded[key] && sessionId) await schema.describe(sessionId, ns, name);
  }
</script>

<Panel title="Schema">
  {#snippet actions()}
    {#if view?.tree && view.tree.namespaces.length > 0}
      <IconButton
        icon={Plus}
        title="New table"
        size="sm"
        onclick={() => newTable(view.tree!.namespaces[0].name)}
      />
    {/if}
  {/snippet}

  {#if view?.tree && view.tree.namespaces.length > 0}
    <div class="flex shrink-0 flex-col gap-2 border-b border-outline-variant p-2">
      <SearchField bind:value={filter} label="Filter tables and views" placeholder="Filter…" />
      <div class="flex items-center gap-2">
        <SegmentedButton
          label="Relation kind"
          segments={KIND_SEGMENTS}
          value={kind}
          onchange={(v) => (kind = v as typeof kind)}
        />
        {#if filtering}
          <span class="text-label-sm text-on-surface-muted tabular-nums">{matchCount}</span>
        {/if}
      </div>
    </div>
  {/if}

  <div class="flex-1 overflow-auto py-1">
    {#if !sessionId}
      <EmptyState icon={Boxes} message="Connect to browse the schema." />
    {:else if !view || view.loading}
      <div class="flex items-center gap-2 p-3 text-body-md text-on-surface-muted"><Spinner size="sm" /> Introspecting…</div>
    {:else if view.error}
      <div class="p-3 text-body-md text-error">
        {view.error.message}
        <div class="mt-2">
          <Button size="sm" onclick={() => sessionId && schema.loadTree(sessionId)}>Retry</Button>
        </div>
      </div>
    {:else if filtering && matchCount === 0}
      <EmptyState icon={Boxes} message={`Nothing matches “${filter}”.`} />
    {:else if view.tree && view.tree.namespaces.length > 0}
      <div role="tree">
        {#each namespaces as ns (ns.name)}
          <ContextMenu items={nsMenu(ns.name)}>
            <TreeItem
              label={ns.name}
              icon={Boxes}
              depth={0}
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
                  depth={1}
                  expandable
                  expanded={expanded[tkey]}
                  title={`${rel.kind} · double-click to open data`}
                  onclick={() => toggleTable(ns.name, rel.name)}
                  ondblclick={() => editorTabs.openTable(ns.name, rel.name)}
                  ontoggle={() => toggleTable(ns.name, rel.name)}
                />
              </ContextMenu>
              {#if expanded[tkey] && sessionId}
                {@const desc = schema.describeCached(sessionId, ns.name, rel.name)}
                {#if desc}
                  {#each desc.columns as col (col.name)}
                    <div
                      class="flex h-6 items-center gap-1.5 text-data text-on-surface-variant"
                      style="padding-left:{2 * 12 + 4 + 16}px"
                      title={`${col.typeName}${col.nullable ? " · nullable" : " · not null"}${col.isPk ? " · primary key" : ""}`}
                    >
                      {#if col.isPk}<KeyRound size={11} class="shrink-0 text-warn" />{/if}
                      <span class="truncate">{col.name}</span>
                      <span class="truncate text-on-surface-muted">{col.typeName}</span>
                    </div>
                  {/each}
                  {#if desc.columns.length === 0}
                    <div class="py-1 text-body-sm text-on-surface-muted" style="padding-left:{2 * 12 + 20}px">No columns</div>
                  {/if}
                {:else}
                  <div class="flex items-center gap-2 py-1 text-body-sm text-on-surface-muted" style="padding-left:{2 * 12 + 20}px">
                    <Spinner size="sm" /> Loading columns…
                  </div>
                {/if}
              {/if}
            {/each}
            {#if ns.relations.length === 0}
              <div class="py-1 text-body-sm text-on-surface-muted" style="padding-left:16px">No tables</div>
            {/if}
          {/if}
        {/each}
      </div>
    {:else}
      <EmptyState icon={Boxes} message="No tables or views." />
    {/if}
  </div>
</Panel>
