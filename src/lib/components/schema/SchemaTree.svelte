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
  import AccordionSection from "$lib/components/ui/AccordionSection.svelte";
  import ContextMenu, { type MenuItem } from "$lib/components/ui/ContextMenu.svelte";
  import { connections } from "$lib/stores/connections.svelte";
  import { schema } from "$lib/stores/schema.svelte";
  import { editorTabs } from "$lib/stores/tabs.svelte";
  import { ddl } from "$lib/stores/ddl.svelte";

  const sessionId = $derived(connections.active?.sessionId ?? null);
  let expanded = $state<Record<string, boolean>>({});

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

  function toggleNs(name: string): void {
    expanded[`ns:${name}`] = !expanded[`ns:${name}`];
  }
  async function toggleTable(ns: string, name: string): Promise<void> {
    const key = `tbl:${ns}:${name}`;
    expanded[key] = !expanded[key];
    if (expanded[key] && sessionId) await schema.describe(sessionId, ns, name);
  }
</script>

<AccordionSection id="schema" title="Schema">
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

  <div class="flex-1 overflow-auto py-1">
    {#if !sessionId}
      <EmptyState icon={Boxes} message="Connect to browse the schema." />
    {:else if !view || view.loading}
      <div class="flex items-center gap-2 p-3 text-sm text-on-surface-muted"><Spinner size="sm" /> Introspecting…</div>
    {:else if view.error}
      <div class="p-3 text-sm text-danger">
        {view.error.message}
        <div class="mt-2">
          <Button size="sm" onclick={() => sessionId && schema.loadTree(sessionId)}>Retry</Button>
        </div>
      </div>
    {:else if view.tree && view.tree.namespaces.length > 0}
      <div role="tree">
        {#each view.tree.namespaces as ns (ns.name)}
          <ContextMenu items={nsMenu(ns.name)}>
            <TreeItem
              label={ns.name}
              icon={Boxes}
              depth={0}
              expandable
              expanded={expanded[`ns:${ns.name}`]}
              onclick={() => toggleNs(ns.name)}
              ontoggle={() => toggleNs(ns.name)}
            />
          </ContextMenu>
          {#if expanded[`ns:${ns.name}`]}
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
                      class="flex h-6 items-center gap-1.5 font-mono text-xs text-on-surface-variant"
                      style="padding-left:{2 * 12 + 4 + 16}px"
                      title={`${col.typeName}${col.nullable ? " · nullable" : " · not null"}${col.isPk ? " · primary key" : ""}`}
                    >
                      {#if col.isPk}<KeyRound size={11} class="shrink-0 text-warn" />{/if}
                      <span class="truncate">{col.name}</span>
                      <span class="truncate text-on-surface-muted">{col.typeName}</span>
                    </div>
                  {/each}
                  {#if desc.columns.length === 0}
                    <div class="py-1 text-xs text-on-surface-muted" style="padding-left:{2 * 12 + 20}px">No columns</div>
                  {/if}
                {:else}
                  <div class="flex items-center gap-2 py-1 text-xs text-on-surface-muted" style="padding-left:{2 * 12 + 20}px">
                    <Spinner size="sm" /> Loading columns…
                  </div>
                {/if}
              {/if}
            {/each}
            {#if ns.relations.length === 0}
              <div class="py-1 text-xs text-on-surface-muted" style="padding-left:16px">No tables</div>
            {/if}
          {/if}
        {/each}
      </div>
    {:else}
      <EmptyState icon={Boxes} message="No tables or views." />
    {/if}
  </div>
</AccordionSection>
