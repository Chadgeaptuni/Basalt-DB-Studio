<script lang="ts">
  import Badge from "$lib/components/ui/Badge.svelte";
  import { ENGINE_TAG } from "$lib/utils/connectionLabel";
  import { envLabel, envTone } from "$lib/utils/environment";
  import { connections } from "$lib/stores/connections.svelte";

  // Which database the workspace is pointed at, as a reading rather than a
  // control: the schema panel owns connecting, disconnecting and editing now
  // (DESIGN §5), so a popover here would be a second manager for the same list.
  //
  // It still has to be *visible at all times*, which is what keeps it in the
  // status bar — the environment badge is worth nothing on a surface you can
  // close.
  $effect(() => {
    void connections.load();
  });

  const profile = $derived(
    connections.profiles.find(
      (p) => connections.statusFor(p.id).session?.sessionId === connections.active?.sessionId,
    ) ?? null,
  );
</script>

<div class="flex h-7 min-w-0 max-w-72 items-center gap-1.5 px-2 text-data">
  {#if connections.active && profile}
    <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-ok"></span>
    <span class="shrink-0 text-on-surface-muted">{ENGINE_TAG[connections.active.engine]}</span>
    <span class="min-w-0 truncate text-on-surface-variant">{profile.name}</span>
    <!-- Label as well as colour: which database you are pointed at is exactly the
         thing that must not depend on distinguishing red from amber. -->
    {#if profile.environment}
      <Badge variant={envTone(profile.environment)}>{envLabel(profile.environment)}</Badge>
    {/if}
    {#if connections.active.readOnly}<Badge variant="warn">read-only</Badge>{/if}
  {:else}
    <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-on-surface-muted"></span>
    <span class="min-w-0 truncate text-on-surface-muted">Not connected</span>
  {/if}
</div>
