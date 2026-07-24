<script lang="ts">
  import Boxes from "@lucide/svelte/icons/boxes";
  import Table from "@lucide/svelte/icons/table";
  import Eye from "@lucide/svelte/icons/eye";
  import KeyRound from "@lucide/svelte/icons/key-round";
  import TreeItem from "$lib/components/ui/TreeItem.svelte";
  import Spinner from "$lib/components/ui/Spinner.svelte";
  import EmptyState from "$lib/components/ui/EmptyState.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import { connections } from "$lib/stores/connections.svelte";
  import { schema } from "$lib/stores/schema.svelte";

  const sessionId = $derived(connections.active?.sessionId ?? null);
  let expanded = $state<Record<string, boolean>>({});

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

<div class="flex h-full flex-col">
  <header class="flex h-9 items-center border-b border-border px-3">
    <span class="text-xs font-medium tracking-wider text-fg-2 uppercase">Schema</span>
  </header>

  <div class="flex-1 overflow-auto py-1">
    {#if !sessionId}
      <EmptyState icon={Boxes} message="Connect to browse the schema." />
    {:else if !view || view.loading}
      <div class="flex items-center gap-2 p-3 text-sm text-fg-2"><Spinner size="sm" /> Introspecting…</div>
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
          <TreeItem
            label={ns.name}
            icon={Boxes}
            depth={0}
            expandable
            expanded={expanded[`ns:${ns.name}`]}
            onclick={() => toggleNs(ns.name)}
            ontoggle={() => toggleNs(ns.name)}
          />
          {#if expanded[`ns:${ns.name}`]}
            {#each ns.relations as rel (rel.name)}
              {@const tkey = `tbl:${ns.name}:${rel.name}`}
              <TreeItem
                label={rel.name}
                icon={rel.kind === "view" ? Eye : Table}
                depth={1}
                expandable
                expanded={expanded[tkey]}
                title={rel.kind}
                onclick={() => toggleTable(ns.name, rel.name)}
                ontoggle={() => toggleTable(ns.name, rel.name)}
              />
              {#if expanded[tkey] && sessionId}
                {@const desc = schema.describeCached(sessionId, ns.name, rel.name)}
                {#if desc}
                  {#each desc.columns as col (col.name)}
                    <div
                      class="flex h-6 items-center gap-1.5 font-mono text-xs text-fg-1"
                      style="padding-left:{2 * 12 + 4 + 16}px"
                      title={`${col.typeName}${col.nullable ? " · nullable" : " · not null"}${col.isPk ? " · primary key" : ""}`}
                    >
                      {#if col.isPk}<KeyRound size={11} class="shrink-0 text-warn" />{/if}
                      <span class="truncate">{col.name}</span>
                      <span class="truncate text-fg-2">{col.typeName}</span>
                    </div>
                  {/each}
                  {#if desc.columns.length === 0}
                    <div class="py-1 text-xs text-fg-2" style="padding-left:{2 * 12 + 20}px">No columns</div>
                  {/if}
                {:else}
                  <div class="flex items-center gap-2 py-1 text-xs text-fg-2" style="padding-left:{2 * 12 + 20}px">
                    <Spinner size="sm" /> Loading columns…
                  </div>
                {/if}
              {/if}
            {/each}
            {#if ns.relations.length === 0}
              <div class="py-1 text-xs text-fg-2" style="padding-left:16px">No tables</div>
            {/if}
          {/if}
        {/each}
      </div>
    {:else}
      <EmptyState icon={Boxes} message="No tables or views." />
    {/if}
  </div>
</div>
