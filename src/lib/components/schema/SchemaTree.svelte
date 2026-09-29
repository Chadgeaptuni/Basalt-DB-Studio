<script lang="ts">
  import Database from "@lucide/svelte/icons/database";
  import RotateCw from "@lucide/svelte/icons/rotate-cw";
  import EmptyState from "$lib/components/ui/EmptyState.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import IconButton from "$lib/components/ui/IconButton.svelte";
  import Panel from "$lib/components/layout/Panel.svelte";
  import SearchField from "$lib/components/ui/SearchField.svelte";
  import SegmentedButton, { type Segment } from "$lib/components/ui/SegmentedButton.svelte";
  import ConnectionSchema from "./ConnectionSchema.svelte";
  import DatabaseList from "./DatabaseList.svelte";
  import { hasDatabaseLevel, refreshProfile } from "./tree";
  import { connections } from "$lib/stores/connections.svelte";
  import { panel } from "$lib/stores/panel.svelte";
  import type { RelationKind } from "$lib/api/types";

  // The object explorer for the connection the workspace is pointed at. The
  // connections themselves live in their own panel (DESIGN §5); this one shows
  // what the active one holds. A Postgres profile opens onto its databases,
  // because a pg session can only ever see the one it connected to — each
  // database row below is its own session.
  let filter = $state("");
  let kind = $state<"all" | RelationKind>("all");

  const KIND_SEGMENTS: Segment[] = [
    { value: "all", label: "All" },
    { value: "table", label: "Tables" },
    { value: "view", label: "Views" },
  ];

  const profile = $derived(
    connections.profiles.find((p) => p.id === connections.active?.profileId) ?? null,
  );
  /** The session the database list is discovered over: the profile's own. */
  const server = $derived(profile ? connections.statusFor(profile.id).session : undefined);
</script>

<Panel title={profile?.name ?? "Schema"}>
  {#snippet actions()}
    {#if profile}
      <IconButton icon={RotateCw} title="Refresh" size="sm" onclick={() => refreshProfile(profile)} />
    {/if}
  {/snippet}

  {#if profile && connections.active}
    <div class="flex shrink-0 flex-col gap-2 border-b border-outline-variant p-2">
      <SearchField bind:value={filter} label="Filter tables and views" placeholder="Filter…" />
      <SegmentedButton
        label="Relation kind"
        segments={KIND_SEGMENTS}
        value={kind}
        onchange={(v) => (kind = v as typeof kind)}
      />
    </div>

    <div role="tree" class="flex-1 overflow-auto py-1">
      {#if hasDatabaseLevel(profile) && server}
        <DatabaseList {profile} sessionId={server.sessionId} {filter} {kind} />
      {:else}
        {@const session = connections.active}
        <ConnectionSchema
          sessionId={session.sessionId}
          {filter}
          {kind}
          activate={() => connections.setActive(session)}
        />
      {/if}
    </div>
  {:else}
    <EmptyState icon={Database} message="No connection open." hint="Open one to browse its tables and views.">
      {#snippet action()}
        <Button size="sm" onclick={() => panel.select("connections")}>Show connections</Button>
      {/snippet}
    </EmptyState>
  {/if}
</Panel>
