<script lang="ts">
  import type { Snippet } from "svelte";
  import Plug from "@lucide/svelte/icons/plug";
  import Unplug from "@lucide/svelte/icons/unplug";
  import RotateCw from "@lucide/svelte/icons/rotate-cw";
  import TreeItem from "$lib/components/ui/TreeItem.svelte";
  import Spinner from "$lib/components/ui/Spinner.svelte";
  import ContextMenu from "$lib/components/ui/ContextMenu.svelte";
  import type { MenuItem } from "$lib/components/ui/menu";
  import type { IconComponent } from "$lib/components/ui/icon";
  import type { SessionInfo } from "$lib/api/types";
  import { connections, type ConnState } from "$lib/stores/connections.svelte";
  import { branchIndent, ICON_TONE } from "./tree";

  // A tree node that owns a session. A connection root and a Postgres database
  // row are the same node at two depths: expanding one *opens* it, the glyph
  // carries its status, the branch beneath it is what it opened, and Refresh and
  // Disconnect act on that session.
  //
  // Declared once because it was two copies and they had already drifted apart —
  // the root guarded against connecting while a connect was in flight and the
  // database row did not, which orphaned a live pool.
  interface Props {
    label: string;
    icon: IconComponent;
    depth: number;
    title: string;
    /** This node's session state, read from the connections store. */
    state: ConnState;
    expanded: boolean;
    /** Whether clicking the row points the workspace at this session. False for a
     *  node whose session is not the one statements run against: a Postgres
     *  connection root holds the *server's* session, on the maintenance database,
     *  and the databases beneath it are what you query. */
    activates?: boolean;
    /** Opens this node's session. A null result re-collapses the node. */
    open: () => Promise<SessionInfo | null>;
    /** Drops this node's cached introspection. */
    refresh: () => void;
    /** Closes the session. Omitted when it is not this node's to close — the
     *  database row that reuses its parent's session. */
    close?: () => void;
    onexpand: (expanded: boolean) => void;
    /** Menu groups appended after this node's own session group. */
    menu?: MenuItem[][];
    branch: Snippet<[SessionInfo]>;
  }

  let {
    label,
    icon,
    depth,
    title,
    state,
    expanded,
    activates = true,
    open,
    refresh,
    close,
    onexpand,
    menu = [],
    branch,
  }: Props = $props();

  const selected = $derived(
    !!state.session && connections.active?.sessionId === state.session.sessionId,
  );

  async function toggle(): Promise<void> {
    if (activates && state.session) connections.setActive(state.session);
    const next = !expanded;
    onexpand(next);
    if (!next || state.status === "connected" || state.status === "connecting") return;
    // A failed open collapses the node again: the toast says what went wrong, and
    // an open node with nothing under it says only that something did.
    if (!(await open())) onexpand(false);
  }

  // Two sections, because the rows mean two different things: what this session
  // does, then whatever the node's owner adds about its subject.
  function items(): MenuItem[][] {
    const closeNode = close;
    const session: MenuItem[] = state.session
      ? [
          { label: "Refresh", icon: RotateCw, onselect: refresh },
          ...(closeNode
            ? [
                {
                  label: "Disconnect",
                  icon: Unplug,
                  onselect: () => {
                    onexpand(false);
                    closeNode();
                  },
                },
              ]
            : []),
        ]
      : [{ label: "Connect", icon: Plug, onselect: () => void toggle() }];
    return [session, ...menu].filter((group) => group.length > 0);
  }
</script>

<ContextMenu items={items()}>
  <TreeItem
    {label}
    {icon}
    iconClass={ICON_TONE[state.status]}
    {depth}
    expandable
    {expanded}
    {selected}
    {title}
    onclick={() => void toggle()}
    ontoggle={() => void toggle()}
  />
</ContextMenu>

{#if state.status === "connecting"}
  <div
    class="flex items-center gap-2 py-1 text-body-sm text-on-surface-muted"
    style="padding-left:{branchIndent(depth + 1)}px"
  >
    <Spinner size="sm" /> Connecting…
  </div>
{:else if expanded && state.session}
  {@render branch(state.session)}
{/if}
