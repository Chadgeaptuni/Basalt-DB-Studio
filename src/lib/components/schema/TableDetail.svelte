<script lang="ts">
  import KeyRound from "@lucide/svelte/icons/key-round";
  import ListTree from "@lucide/svelte/icons/list-tree";
  import Spinner from "$lib/components/ui/Spinner.svelte";
  import ContextMenu from "$lib/components/ui/ContextMenu.svelte";
  import type { MenuItem } from "$lib/components/ui/menu";
  import type { Engine } from "$lib/api/types";
  import { schema } from "$lib/stores/schema.svelte";
  import { ddl } from "$lib/stores/ddl.svelte";

  // What an expanded table holds: its columns, then its indexes, each with the
  // actions that change it. Rows, not tree items — nothing here expands.
  interface Props {
    sessionId: string;
    namespace: string;
    table: string;
    engine: Engine;
    indent: number;
    activate: () => void;
  }
  let { sessionId, namespace, table, engine, indent, activate }: Props = $props();

  const desc = $derived(schema.describeCached(sessionId, namespace, table));

  function act(run: () => void): () => void {
    return () => {
      activate();
      run();
    };
  }

  function columnMenu(name: string, typeName: string, nullable: boolean): MenuItem[][] {
    // SQLite's ALTER TABLE cannot change a column in place.
    const change: MenuItem[] =
      engine === "sqlite"
        ? []
        : [
            {
              label: "Change column…",
              onselect: act(() =>
                ddl.open({ type: "column", namespace, table, column: { name, typeName, nullable } }),
              ),
            },
          ];
    return [
      [
        ...change,
        { label: "Rename column…", onselect: act(() => ddl.open({ type: "rename", namespace, table, column: name })) },
      ],
      [
        {
          label: "Drop column",
          danger: true,
          onselect: act(() => ddl.preview({ kind: "dropColumn", namespace, table, column: name })),
        },
      ],
    ];
  }

  function indexMenu(name: string): MenuItem[] {
    return [
      {
        label: "Drop index",
        danger: true,
        onselect: act(() => ddl.preview({ kind: "dropIndex", namespace, table, name })),
      },
    ];
  }
</script>

{#snippet row(title: string)}
  <div class="py-1 text-body-sm text-on-surface-muted" style="padding-left:{indent}px">{title}</div>
{/snippet}

{#if !desc}
  <div class="flex items-center gap-2 py-1 text-body-sm text-on-surface-muted" style="padding-left:{indent}px">
    <Spinner size="sm" /> Loading columns…
  </div>
{:else}
  {#each desc.columns as col (col.name)}
    <ContextMenu items={columnMenu(col.name, col.typeName, col.nullable)}>
      <div
        class="flex h-7 items-center gap-1.5 text-data text-on-surface-variant"
        style="padding-left:{indent}px"
        title={`${col.typeName}${col.nullable ? " · nullable" : " · not null"}${col.isPk ? " · primary key" : ""}`}
      >
        {#if col.isPk}<KeyRound size={11} class="shrink-0 text-warn" />{/if}
        <span class="truncate">{col.name}</span>
        <span class="truncate text-on-surface-muted">{col.typeName}</span>
      </div>
    </ContextMenu>
  {/each}
  {#if desc.columns.length === 0}{@render row("No columns")}{/if}
  {#each desc.indexes as index (index.name)}
    <ContextMenu items={indexMenu(index.name)}>
      <div
        class="flex h-7 items-center gap-1.5 text-data text-on-surface-muted"
        style="padding-left:{indent}px"
        title={`${index.unique ? "unique index" : "index"} on ${index.columns.join(", ")}`}
      >
        <ListTree size={11} class="shrink-0" />
        <span class="truncate">{index.name}</span>
        <span class="truncate">({index.columns.join(", ")})</span>
      </div>
    </ContextMenu>
  {/each}
{/if}
