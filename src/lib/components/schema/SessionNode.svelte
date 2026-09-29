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

  // A tree node that owns a session — a Postgres database row. Expanding one
  // *opens* it, the icon carries its status, the branch beneath it is what it
  // opened, and Refresh and Disconnect act on that session. Guards against a
  // second connect while one is in flight, which would orphan a live pool.
  interface Props {
    label: string;
    icon: IconComponent;
    depth: number;
    title: string;
    /** This node's session state, read from the connections store. */
    state: ConnState;
    expanded: boolean;
    /** Opens this node's session. A null result re-collapses the node. */
    open: () => Promise<SessionInfo | null>;
    /** Drops this node's cached introspection. */
    refresh: () => void;
    /** Closes the session. Omitted when it is not this node's to close — the
     *  database row that reuses its parent's session. */
    close?: () => void;
    onexpand: (expanded: boolean) => void;
    branch: Snippet<[SessionInfo]>;
  }

  let {
    label,
    icon,
    depth,
    title,
    state,
    expanded,
    open,
    refresh,
    close,
    onexpand,
    branch,
  }: Props = $props();

  const selected = $derived(
    !!state.session && connections.active?.sessionId === state.session.sessionId,
  );

  async function toggle(): Promise<void> {
    if (state.session) connections.setActive(state.session);
    const next = !expanded;
    onexpand(next);
    if (!next || state.status === "connected" || state.status === "connecting") return;
    // A failed open collapses the node again: the toast says what went wrong, and
    // an open node with nothing under it says only that something did.
    if (!(await open())) onexpand(false);
  }

  function items(): MenuItem[] {
    const closeNode = close;
    return state.session
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
