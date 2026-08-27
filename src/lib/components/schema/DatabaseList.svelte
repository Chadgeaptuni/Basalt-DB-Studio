<script lang="ts">
  import DatabaseIcon from "@lucide/svelte/icons/database";
  import Unplug from "@lucide/svelte/icons/unplug";
  import RotateCw from "@lucide/svelte/icons/rotate-cw";
  import TreeItem from "$lib/components/ui/TreeItem.svelte";
  import Spinner from "$lib/components/ui/Spinner.svelte";
  import ErrorState from "$lib/components/ui/ErrorState.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import ContextMenu from "$lib/components/ui/ContextMenu.svelte";
  import type { MenuItem } from "$lib/components/ui/menu";
  import type { ConnectionProfile, RelationKind } from "$lib/api/types";
  import ConnectionSchema from "./ConnectionSchema.svelte";
  import { connections, type ConnStatus } from "$lib/stores/connections.svelte";
  import { schema } from "$lib/stores/schema.svelte";

  // The database level of a Postgres connection — pgAdmin's server node. It
  // exists only for Postgres, because only Postgres needs it: a pg connection is
  // bound for its life to the database it opened, so the server's other
  // databases are neither browsable nor queryable over this session. Expanding
  // one therefore *opens* it, as its own session against its own pool. MySQL
  // already sees every database on the server as a namespace of one connection
  // and a SQLite file is the database, so neither draws this level at all.
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
  const BRANCH_INDENT = (DB_DEPTH + 1) * 12 + 20;

  let expanded = $state<Record<string, boolean>>({});

  $effect(() => {
    if (!schema.databases(sessionId)) void schema.loadDatabases(sessionId);
  });

  const view = $derived(schema.databases(sessionId));

  // Filtering the database list by the table filter would hide the database the
  // match is in, so the filter passes straight through to each open branch and
  // the list itself always shows every database (DESIGN §6).
  const databases = $derived(view?.list ?? []);

  const ICON_TONE: Record<ConnStatus, string> = {
    connected: "text-ok",
    connecting: "text-warn",
    error: "text-error",
    disconnected: "text-on-surface-muted",
  };

  function sessionFor(database: string) {
    return connections.databaseStateFor(profile.id, database).session;
  }

  function statusFor(database: string): ConnStatus {
    return connections.databaseStateFor(profile.id, database).status;
  }

  async function toggle(database: string): Promise<void> {
    const open = !expanded[database];
    expanded[database] = open;
    if (!open) return;

    const existing = sessionFor(database);
    if (existing) {
      connections.setActive(existing);
      return;
    }
    // A failed open collapses the row again: the toast says what went wrong, and
    // an open node with nothing under it says only that something did.
    if (!(await connections.connectDatabase(profile.id, database))) expanded[database] = false;
  }

  function dbMenu(database: string): MenuItem[][] {
    const session = sessionFor(database);
    const isServerSession = connections.statusFor(profile.id).session?.database === database;
    if (!session) return [[{ label: "Open", onselect: () => void toggle(database) }]];
    return [
      [{ label: "Refresh", icon: RotateCw, onselect: () => schema.clear(session.sessionId) }],
      // The maintenance database's session is the connection's own — closing it
      // here would take the database list down with it, so that row offers the
      // close on the connection root instead of a Disconnect that guts its parent.
      isServerSession
        ? []
        : [
            {
              label: "Disconnect",
              icon: Unplug,
              onselect: () => {
                expanded[database] = false;
                void connections.disconnectDatabase(profile.id, database);
              },
            },
          ],
    ].filter((group) => group.length > 0);
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
    {@const session = sessionFor(database)}
    <ContextMenu items={dbMenu(database)}>
      <TreeItem
        label={database}
        icon={DatabaseIcon}
        iconClass={ICON_TONE[statusFor(database)]}
        depth={DB_DEPTH}
        expandable
        expanded={expanded[database]}
        selected={!!session && connections.active?.sessionId === session.sessionId}
        title={`database on ${profile.host ?? ""}`}
        onclick={() => void toggle(database)}
        ontoggle={() => void toggle(database)}
      />
    </ContextMenu>

    {#if statusFor(database) === "connecting"}
      <div
        class="flex items-center gap-2 py-1 text-body-sm text-on-surface-muted"
        style="padding-left:{BRANCH_INDENT}px"
      >
        <Spinner size="sm" /> Connecting…
      </div>
    {:else if expanded[database] && session}
      <ConnectionSchema
        sessionId={session.sessionId}
        {filter}
        {kind}
        depth={DB_DEPTH + 1}
        activate={() => connections.setActive(session)}
      />
    {/if}
  {/each}
{/if}
