<script lang="ts">
  import { Popover } from "bits-ui";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import Plug from "@lucide/svelte/icons/plug";
  import Unplug from "@lucide/svelte/icons/unplug";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import RotateCw from "@lucide/svelte/icons/rotate-cw";
  import Database from "@lucide/svelte/icons/database";
  import Button from "$lib/components/ui/Button.svelte";
  import IconButton from "$lib/components/ui/IconButton.svelte";
  import Badge from "$lib/components/ui/Badge.svelte";
  import Spinner from "$lib/components/ui/Spinner.svelte";
  import { stateLayer, focusRing } from "$lib/components/ui/stateLayer";
  import { envLabel, envTone } from "$lib/utils/environment";
  import EmptyState from "$lib/components/ui/EmptyState.svelte";
  import ConnectionForm from "./ConnectionForm.svelte";
  import ConnectionRow from "./ConnectionRow.svelte";
  import { connections } from "$lib/stores/connections.svelte";
  import { confirm } from "$lib/stores/dialogs.svelte";
  import ErrorState from "$lib/components/ui/ErrorState.svelte";
  import type { ConnectionProfile, Engine } from "$lib/api/types";

  // The app's one connection surface (DESIGN §5): the trigger states which
  // database the workspace is pointed at, the panel manages every profile.
  //
  // It lives in the status bar rather than the top app bar. Which database you
  // are pointed at is *run state* — the same class of thing as the transaction
  // badge and the row count it now sits beside — and the top bar is for
  // navigation. It also has to stay visible at all times for the environment
  // badge to be worth anything, which rules out the start panel.
  const ENGINE_TAG: Record<Engine, string> = { postgres: "PG", mysql: "MY", sqlite: "SQ" };

  let open = $state(false);
  let form = $state<{ profile: ConnectionProfile | null } | null>(null);

  $effect(() => {
    void connections.load();
  });

  const activeProfile = $derived(
    connections.profiles.find(
      (p) => connections.statusFor(p.id).session?.sessionId === connections.active?.sessionId,
    ) ?? null,
  );

  async function activate(p: ConnectionProfile): Promise<void> {
    open = false;
    await connections.activate(p.id);
  }

  async function toggle(p: ConnectionProfile): Promise<void> {
    const s = connections.statusFor(p.id);
    if (s.status === "connected") await connections.disconnect(p.id);
    else await connections.connect(p.id);
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
</script>

<Popover.Root bind:open>
  <!-- Sized to its content, not to a minimum: in a 32px bar a fixed-width pill
       reads as a form control wedged into the chrome. No border either — the bar
       is already a distinct surface, so the state layer alone marks it as
       pressable (DESIGN §2). 28px is the dense control tier (DESIGN §5) and what
       every other control in the status bar stands at. -->
  <Popover.Trigger
    class="flex h-7 max-w-72 items-center gap-1.5 rounded-full px-2 text-data
      {stateLayer} {focusRing}"
    title="Connection"
  >
    {#if connections.active && activeProfile}
      <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-ok"></span>
      <span class="shrink-0 text-on-surface-muted">{ENGINE_TAG[connections.active.engine]}</span>
      <span class="min-w-0 truncate text-left text-on-surface-variant">{activeProfile.name}</span>
      <!-- Label as well as colour: which database you are pointed at is exactly
           the thing that must not depend on distinguishing red from amber. -->
      {#if activeProfile.environment}
        <Badge variant={envTone(activeProfile.environment)}>
          {envLabel(activeProfile.environment)}
        </Badge>
      {/if}
      {#if connections.active.readOnly}<Badge variant="warn">read-only</Badge>{/if}
    {:else}
      <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-on-surface-muted"></span>
      <span class="min-w-0 truncate text-left text-on-surface-muted">Not connected</span>
    {/if}
    <ChevronDown size={12} class="shrink-0 text-on-surface-muted" />
  </Popover.Trigger>

  <Popover.Portal>
    <!-- Opens upward and aligned to its leading edge: the trigger sits on the
         bottom edge of the window, so there is nowhere below to put it. -->
    <Popover.Content
      side="top"
      align="start"
      sideOffset={4}
      class="z-50 max-h-[min(28rem,calc(100dvh-4rem))] w-96 overflow-auto rounded-md border
        border-outline-variant bg-surface-container-high shadow-e2 outline-none"
    >
      {#if !connections.loaded}
        <div class="flex items-center gap-2 p-3 text-body-md text-on-surface-muted"><Spinner size="sm" /> Loading…</div>
      {:else if connections.loadError}
        <ErrorState kind={connections.loadError.kind} message={connections.loadError.message}>
          {#snippet action()}
            <Button size="sm" onclick={() => connections.load()}>Retry</Button>
          {/snippet}
        </ErrorState>
      {:else if connections.profiles.length === 0}
        <EmptyState icon={Database} message="No connections yet" />
      {:else}
        <ul class="divide-y divide-outline-variant border-b border-outline-variant">
          {#each connections.profiles as p (p.id)}
            {@const st = connections.statusFor(p.id)}
            <li>
              <ConnectionRow
                profile={p}
                selected={!!st.session && connections.active?.sessionId === st.session.sessionId}
                onclick={() => void activate(p)}
              >
                {#snippet actions()}
                  <IconButton
                    icon={st.status === "connected" ? Unplug : Plug}
                    title={st.status === "connected" ? "Disconnect" : "Connect"}
                    size="sm"
                    onclick={() => void toggle(p)}
                  />
                  <IconButton icon={Pencil} title="Edit" size="sm" onclick={() => (form = { profile: p })} />
                  <IconButton icon={Trash2} title="Delete" size="sm" onclick={() => void del(p)} />
                {/snippet}
              </ConnectionRow>
              {#if st.status === "error" && st.error}
                <ErrorState kind={st.error.kind} message={st.error.message} size="inline" filled>
                  {#snippet action()}
                    <IconButton icon={RotateCw} title="Retry" size="sm" onclick={() => connections.connect(p.id)} />
                  {/snippet}
                </ErrorState>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}

      <div class="flex justify-end p-2">
        <Button size="sm" onclick={() => (form = { profile: null })}>New connection</Button>
      </div>
    </Popover.Content>
  </Popover.Portal>
</Popover.Root>

{#if form}
  <ConnectionForm profile={form.profile} onclose={() => (form = null)} />
{/if}
