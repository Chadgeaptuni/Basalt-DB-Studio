<script lang="ts">
  import Database from "@lucide/svelte/icons/database";
  import Plus from "@lucide/svelte/icons/plus";
  import Plug from "@lucide/svelte/icons/plug";
  import Unplug from "@lucide/svelte/icons/unplug";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import RotateCw from "@lucide/svelte/icons/rotate-cw";
  import TreeItem from "$lib/components/ui/TreeItem.svelte";
  import Spinner from "$lib/components/ui/Spinner.svelte";
  import EmptyState from "$lib/components/ui/EmptyState.svelte";
  import ErrorState from "$lib/components/ui/ErrorState.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import IconButton from "$lib/components/ui/IconButton.svelte";
  import Panel from "$lib/components/layout/Panel.svelte";
  import SearchField from "$lib/components/ui/SearchField.svelte";
  import SegmentedButton, { type Segment } from "$lib/components/ui/SegmentedButton.svelte";
  import ContextMenu from "$lib/components/ui/ContextMenu.svelte";
  import type { MenuItem } from "$lib/components/ui/menu";
  import ConnectionForm from "$lib/components/connections/ConnectionForm.svelte";
  import ConnectionSchema from "./ConnectionSchema.svelte";
  import DatabaseList from "./DatabaseList.svelte";
  import { ENGINE_TAG, ENGINE_ICON, connectionTarget } from "$lib/utils/connectionLabel";
  import { connections, type ConnStatus } from "$lib/stores/connections.svelte";
  import { schema } from "$lib/stores/schema.svelte";
  import { confirm } from "$lib/stores/dialogs.svelte";
  import type { ConnectionProfile, RelationKind } from "$lib/api/types";

  // The object explorer, rooted at the connections themselves — pgAdmin's shape.
  // A saved profile is a tree root whether or not it is connected: expanding one
  // connects it, and several can be open at once, so the panel is both the
  // connection list and the schema browser. That is why there is no connection
  // popover anywhere else in the app any more (DESIGN §5); the status bar states
  // which session the workspace is pointed at and nothing more.
  let expanded = $state<Record<string, boolean>>({});
  let filter = $state("");
  let kind = $state<"all" | RelationKind>("all");
  let form = $state<{ profile: ConnectionProfile | null } | null>(null);

  const KIND_SEGMENTS: Segment[] = [
    { value: "all", label: "All" },
    { value: "table", label: "Tables" },
    { value: "view", label: "Views" },
  ];

  // Colour is a reinforcement here, not the signal: the row also carries its
  // state in the branch beneath it (spinner, error, schema) (DESIGN §7).
  const ICON_TONE: Record<ConnStatus, string> = {
    connected: "text-ok",
    connecting: "text-warn",
    error: "text-error",
    disconnected: "text-on-surface-muted",
  };

  $effect(() => {
    void connections.load();
  });

  /** True once anything is open that the filter could apply to. */
  const anyOpen = $derived(
    connections.profiles.some(
      (p) => expanded[p.id] && connections.statusFor(p.id).status === "connected",
    ),
  );

  function isActive(p: ConnectionProfile): boolean {
    const session = connections.statusFor(p.id).session;
    return !!session && connections.active?.sessionId === session.sessionId;
  }

  /** Expanding a disconnected root connects it — the connection *is* the node. */
  async function toggle(p: ConnectionProfile): Promise<void> {
    const st = connections.statusFor(p.id);
    if (st.status === "connected" && st.session) connections.setActive(st.session);
    expanded[p.id] = !expanded[p.id];
    if (expanded[p.id] && st.status !== "connected" && st.status !== "connecting") {
      // Failing to connect collapses the root again: the toast says what went
      // wrong, and an open root with nothing under it says only that something did.
      if (!(await connections.connect(p.id))) expanded[p.id] = false;
    }
  }

  function activate(p: ConnectionProfile): void {
    const session = connections.statusFor(p.id).session;
    if (session) connections.setActive(session);
  }

  async function del(p: ConnectionProfile): Promise<void> {
    const ok = await confirm({
      title: `Delete connection “${p.name}”?`,
      message: "This removes the saved profile. The database itself is untouched.",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (ok) await connections.remove(p.id);
  }

  // Two sections, because the rows mean two different things: what this *session*
  // does, then what happens to the saved *profile*. Delete is the last row of the
  // second, past a hairline, so it is never the neighbour of Disconnect.
  function connMenu(p: ConnectionProfile): MenuItem[][] {
    const st = connections.statusFor(p.id);
    const session: MenuItem[] =
      st.status === "connected"
        ? [
            {
              label: "Refresh",
              icon: RotateCw,
              onselect: () => st.session && schema.clear(st.session.sessionId),
            },
            {
              label: "Disconnect",
              icon: Unplug,
              onselect: () => {
                expanded[p.id] = false;
                void connections.disconnect(p.id);
              },
            },
          ]
        : [{ label: "Connect", icon: Plug, onselect: () => void connections.connect(p.id) }];
    return [
      session,
      [
        { label: "Edit…", icon: Pencil, onselect: () => (form = { profile: p }) },
        { label: "Delete", icon: Trash2, danger: true, onselect: () => void del(p) },
      ],
    ];
  }
</script>

<Panel title="Schema">
  {#snippet actions()}
    <!-- Only while there is a list to add to: with none saved the empty state
         below carries the same action as a labelled button, and two controls
         with one accessible name is a control too many. -->
    {#if connections.profiles.length > 0}
      <IconButton
        icon={Plus}
        title="New connection"
        size="sm"
        onclick={() => (form = { profile: null })}
      />
    {/if}
  {/snippet}

  {#if anyOpen}
    <div class="flex shrink-0 flex-col gap-2 border-b border-outline-variant p-2">
      <SearchField bind:value={filter} label="Filter tables and views" placeholder="Filter…" />
      <SegmentedButton
        label="Relation kind"
        segments={KIND_SEGMENTS}
        value={kind}
        onchange={(v) => (kind = v as typeof kind)}
      />
    </div>
  {/if}

  <div class="flex-1 overflow-auto py-1">
    {#if !connections.loaded}
      <div class="flex items-center gap-2 p-3 text-body-md text-on-surface-muted">
        <Spinner size="sm" /> Loading…
      </div>
    {:else if connections.loadError}
      <ErrorState kind={connections.loadError.kind} message={connections.loadError.message}>
        {#snippet action()}
          <Button size="sm" onclick={() => connections.load()}>Retry</Button>
        {/snippet}
      </ErrorState>
    {:else if connections.profiles.length === 0}
      <EmptyState
        icon={Database}
        message="No connections yet."
        hint="Add one to browse its tables and views."
      >
        {#snippet action()}
          <Button variant="filled" size="sm" onclick={() => (form = { profile: null })}>
            New connection
          </Button>
        {/snippet}
      </EmptyState>
    {:else}
      <div role="tree">
        {#each connections.profiles as p (p.id)}
          {@const st = connections.statusFor(p.id)}
          <ContextMenu items={connMenu(p)}>
            <TreeItem
              label={p.name}
              icon={ENGINE_ICON[p.engine]}
              iconClass={ICON_TONE[st.status]}
              depth={0}
              expandable
              expanded={expanded[p.id]}
              selected={isActive(p)}
              title={`${ENGINE_TAG[p.engine]} · ${connectionTarget(p)}`}
              onclick={() => void toggle(p)}
              ontoggle={() => void toggle(p)}
            />
          </ContextMenu>

          {#if st.status === "connecting"}
            <div class="flex items-center gap-2 py-1 pl-8 text-body-sm text-on-surface-muted">
              <Spinner size="sm" /> Connecting…
            </div>
          {:else if expanded[p.id] && st.session}
            <!-- Postgres roots open onto their databases, because a pg session
                 can only ever see the one it connected to; the other engines
                 have no such level and go straight to their namespaces. -->
            {#if p.engine === "postgres"}
              <DatabaseList profile={p} sessionId={st.session.sessionId} {filter} {kind} />
            {:else}
              <ConnectionSchema
                sessionId={st.session.sessionId}
                {filter}
                {kind}
                activate={() => activate(p)}
              />
            {/if}
          {/if}
        {/each}
      </div>
    {/if}
  </div>
</Panel>

{#if form}
  <ConnectionForm profile={form.profile} onclose={() => (form = null)} />
{/if}
