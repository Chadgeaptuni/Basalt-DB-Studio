<script lang="ts">
  import Database from "@lucide/svelte/icons/database";
  import Plus from "@lucide/svelte/icons/plus";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import Plug from "@lucide/svelte/icons/plug";
  import Unplug from "@lucide/svelte/icons/unplug";
  import Spinner from "$lib/components/ui/Spinner.svelte";
  import EmptyState from "$lib/components/ui/EmptyState.svelte";
  import ErrorState from "$lib/components/ui/ErrorState.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import IconButton from "$lib/components/ui/IconButton.svelte";
  import ListItem from "$lib/components/ui/ListItem.svelte";
  import Badge from "$lib/components/ui/Badge.svelte";
  import ContextMenu from "$lib/components/ui/ContextMenu.svelte";
  import type { MenuItem } from "$lib/components/ui/menu";
  import Panel from "$lib/components/layout/Panel.svelte";
  import ConnectionForm from "./ConnectionForm.svelte";
  import { ICON_TONE } from "$lib/components/schema/tree";
  import { ENGINE_TAG, connectionTarget } from "$lib/utils/connectionLabel";
  import { envTag, envTone } from "$lib/utils/environment";
  import { connections } from "$lib/stores/connections.svelte";
  import { confirm } from "$lib/stores/dialogs.svelte";
  import { panel } from "$lib/stores/panel.svelte";
  import type { ConnectionProfile } from "$lib/api/types";

  // Every saved profile, and the one place they are managed: connect,
  // disconnect, edit, delete. Opening one points the workspace at it and moves
  // the panel to its schema, which is what you open a connection to look at.
  let form = $state<{ profile: ConnectionProfile | null } | null>(null);

  $effect(() => {
    void connections.load();
  });

  async function open(p: ConnectionProfile): Promise<void> {
    await connections.activate(p.id);
    if (connections.statusFor(p.id).status === "connected") panel.select("schema");
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

  // Delete is the last row, past a hairline, so it is never Disconnect's neighbour.
  function menu(p: ConnectionProfile): MenuItem[][] {
    const connected = connections.statusFor(p.id).status === "connected";
    return [
      [
        connected
          ? { label: "Disconnect", icon: Unplug, onselect: () => void connections.disconnect(p.id) }
          : { label: "Connect", icon: Plug, onselect: () => void open(p) },
      ],
      [
        { label: "Edit…", icon: Pencil, onselect: () => (form = { profile: p }) },
        { label: "Delete", icon: Trash2, danger: true, onselect: () => void del(p) },
      ],
    ];
  }
</script>

<Panel title="Connections">
  {#snippet actions()}
    <!-- Only while there is a list to add to: with none saved the empty state
         carries the same action as a labelled button. -->
    {#if connections.profiles.length > 0}
      <IconButton icon={Plus} title="New connection" size="sm" onclick={() => (form = { profile: null })} />
    {/if}
  {/snippet}

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
      <EmptyState icon={Database} message="No connections yet." hint="Add one to browse its tables and views.">
        {#snippet action()}
          <Button variant="filled" size="sm" onclick={() => (form = { profile: null })}>
            New connection
          </Button>
        {/snippet}
      </EmptyState>
    {:else}
      {#each connections.profiles as p (p.id)}
        {@const status = connections.statusFor(p.id).status}
        <ContextMenu items={menu(p)}>
          <ListItem
            headline={p.name}
            supporting={ENGINE_TAG[p.engine]}
            title={`${ENGINE_TAG[p.engine]} · ${connectionTarget(p)}`}
            selected={connections.active?.profileId === p.id}
            onclick={() => void open(p)}
          >
            {#snippet leading()}
              {#if status === "connecting"}
                <Spinner size="sm" />
              {:else}
                <Database size={16} strokeWidth={2} class={ICON_TONE[status]} />
              {/if}
            {/snippet}
            {#snippet trailing()}
              {#if p.environment}
                <Badge variant={envTone(p.environment)}>{envTag(p.environment)}</Badge>
              {/if}
              {#if status === "connected"}
                <IconButton
                  icon={Unplug}
                  title={`Disconnect “${p.name}”`}
                  size="sm"
                  onclick={() => void connections.disconnect(p.id)}
                />
              {/if}
            {/snippet}
          </ListItem>
        </ContextMenu>
      {/each}
    {/if}
  </div>
</Panel>

{#if form}
  <ConnectionForm profile={form.profile} onclose={() => (form = null)} />
{/if}
