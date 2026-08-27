<script lang="ts">
  import DatabaseIcon from "@lucide/svelte/icons/database";
  import Spinner from "$lib/components/ui/Spinner.svelte";
  import ErrorState from "$lib/components/ui/ErrorState.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import type { ConnectionProfile, RelationKind } from "$lib/api/types";
  import ConnectionSchema from "./ConnectionSchema.svelte";
  import SessionNode from "./SessionNode.svelte";
  import { branchIndent, refreshSession } from "./tree";
  import { connections, type ConnState } from "$lib/stores/connections.svelte";
  import { schema } from "$lib/stores/schema.svelte";
  import { connectionServer } from "$lib/utils/connectionLabel";

  // The database level of a Postgres connection — pgAdmin's server node. It
  // exists only for Postgres, because only Postgres needs it: a pg connection is
  // bound for its life to the database it opened, so the server's other
  // databases are neither browsable nor queryable over this session. Expanding
  // one therefore *opens* it, as its own session against its own pool. MySQL
  // already sees every database on the server as a namespace of one connection
  // and a SQLite file is the database, so neither draws this level at all.
  //
  // Each row is a SessionNode — the same node the connection root above it is.
  interface Props {
    profile: ConnectionProfile;
    /** The server session, opened against the maintenance database. Used to
     *  discover the list; each database below gets a session of its own. */
    sessionId: string;
    filter: string;
    kind: "all" | RelationKind;
  }
  let { profile, sessionId, filter, kind }: Props = $props();

  const DB_DEPTH = 1;
  const BRANCH_INDENT = branchIndent(DB_DEPTH + 1);

  let expanded = $state<Record<string, boolean>>({});

  $effect(() => {
    if (!schema.databases(sessionId)) void schema.loadDatabases(sessionId);
  });

  const view = $derived(schema.databases(sessionId));
  const server = $derived(connectionServer(profile));

  // Filtering the database list by the table filter would hide the database the
  // match is in, so the filter passes straight through to each open branch and
  // the list itself always shows every database (DESIGN §6).
  const databases = $derived(view?.list ?? []);

  /** The maintenance database's row *is* the connection's own session, so it has
   *  no Disconnect of its own: closing it here would take the database list —
   *  this row's own parent — down with it. The root offers that close instead. */
  function closeFor(database: string, state: ConnState): (() => void) | undefined {
    if (!state.session || state.session.sessionId === sessionId) return undefined;
    return () => void connections.disconnectDatabase(profile.id, database);
  }
</script>

{#if !view || view.loading}
  <div
    class="flex items-center gap-2 py-1 text-body-sm text-on-surface-muted"
    style="padding-left:{BRANCH_INDENT}px"
  >
    <Spinner size="sm" /> Listing databases…
  </div>
{:else if view.error}
  <ErrorState kind={view.error.kind} message={view.error.message} size="inline" filled>
    {#snippet action()}
      <Button variant="text-error" size="sm" onclick={() => schema.loadDatabases(sessionId)}>
        Retry
      </Button>
    {/snippet}
  </ErrorState>
{:else if databases.length === 0}
  <div class="py-1 text-body-sm text-on-surface-muted" style="padding-left:{BRANCH_INDENT}px">
    This role may not open any database on this server.
  </div>
{:else}
  {#each databases as database (database)}
    {@const state = connections.databaseStateFor(profile.id, database)}
    <SessionNode
      label={database}
      icon={DatabaseIcon}
      depth={DB_DEPTH}
      title={server ? `database on ${server}` : "database"}
      {state}
      expanded={!!expanded[database]}
      open={() => connections.connectDatabase(profile.id, database)}
      refresh={() => state.session && refreshSession(state.session.sessionId)}
      close={closeFor(database, state)}
      onexpand={(v) => (expanded[database] = v)}
    >
      {#snippet branch(session)}
        <ConnectionSchema
          sessionId={session.sessionId}
          {filter}
          {kind}
          depth={DB_DEPTH + 1}
          activate={() => connections.setActive(session)}
        />
      {/snippet}
    </SessionNode>
  {/each}
{/if}
