<script lang="ts">
  // The connection identity row: status dot, engine tag, name over target. Shared
  // by the sidebar list and the start panel; each container supplies its own
  // trailing `actions` snippet (revealed on hover via this row's `group`).
  import type { Snippet } from "svelte";
  import Badge from "$lib/components/ui/Badge.svelte";
  import Spinner from "$lib/components/ui/Spinner.svelte";
  import { connections } from "$lib/stores/connections.svelte";
  import type { ConnectionProfile, Engine } from "$lib/api/types";

  interface Props {
    profile: ConnectionProfile;
    selected?: boolean;
    onclick: () => void;
    actions?: Snippet;
  }
  let { profile, selected = false, onclick, actions }: Props = $props();

  const ENGINE_TAG: Record<Engine, string> = { postgres: "PG", mysql: "MY", sqlite: "SQ" };
  const DOT: Record<string, string> = {
    connected: "bg-ok",
    connecting: "bg-warn",
    error: "bg-error",
    disconnected: "bg-on-surface-muted",
  };

  const status = $derived(connections.statusFor(profile.id).status);
  const target = $derived(
    profile.engine === "sqlite"
      ? (profile.filePath ?? "")
      : `${profile.host ?? ""}${profile.port ? `:${profile.port}` : ""}${profile.database ? `/${profile.database}` : ""}`,
  );
</script>

<div
  class="group flex h-9 items-center gap-2 px-3 text-sm transition-colors duration-200 ease-standard
    {selected ? 'bg-surface-container-high' : 'hover:bg-on-surface/8'}"
>
  <span class="h-1.5 w-1.5 shrink-0 rounded-full {DOT[status]}"></span>
  <Badge>{ENGINE_TAG[profile.engine]}</Badge>
  <button type="button" class="min-w-0 flex-1 text-left" {onclick} title={target}>
    <div class="truncate text-on-surface">{profile.name}</div>
    <div class="truncate font-mono text-[11px] text-on-surface-muted">{target}</div>
  </button>
  {#if actions}
    <div class="flex shrink-0 items-center opacity-0 group-hover:opacity-100">{@render actions()}</div>
  {/if}
  {#if status === "connecting"}<Spinner size="sm" />{/if}
</div>
