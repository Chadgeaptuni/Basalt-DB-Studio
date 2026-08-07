<script lang="ts">
  // The connection identity row: status dot, engine tag, name over target. Shared
  // by the connection switcher and the start panel; each container supplies its own
  // trailing `actions` snippet (revealed on hover via this row's `group`).
  import type { Snippet } from "svelte";
  import Badge from "$lib/components/ui/Badge.svelte";
  import Spinner from "$lib/components/ui/Spinner.svelte";
  import { stateLayerPill, focusRing } from "$lib/components/ui/stateLayer";
  import { envLabel, envTone } from "$lib/utils/environment";
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
  class="group flex h-9 items-center gap-2 px-3 text-body-md {stateLayerPill}
    {selected ? 'bg-surface-container-high' : ''}"
>
  <span class="h-1.5 w-1.5 shrink-0 rounded-full {DOT[status]}"></span>
  <Badge>{ENGINE_TAG[profile.engine]}</Badge>
  {#if profile.environment}
    <Badge variant={envTone(profile.environment)}>{envLabel(profile.environment)}</Badge>
  {/if}
  <!-- Name and target share one 36px row: two stacked lines would need M3's
       two-line item (56px even at density −2), a third of a short list. -->
  <button
    type="button"
    class="flex min-w-0 flex-1 items-baseline gap-2 text-left {focusRing}"
    {onclick}
    title={target}
  >
    <span class="truncate text-on-surface">{profile.name}</span>
    <span class="min-w-0 flex-1 truncate text-data text-on-surface-muted">{target}</span>
  </button>
  {#if actions}
    <!-- Fades rather than appearing: at 0→1 with no transition the buttons pop
         into existence under the cursor, which reads as a glitch on a row you
         were only passing over. `focus-within` keeps them reachable by keyboard,
         where there is no hover to trigger on. -->
    <div
      class="flex shrink-0 items-center opacity-0 transition-opacity duration-200 ease-standard
        group-hover:opacity-100 focus-within:opacity-100"
    >
      {@render actions()}
    </div>
  {/if}
  {#if status === "connecting"}<Spinner size="sm" />{/if}
</div>
