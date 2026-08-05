<script lang="ts">
  // The main pane before a session exists: what to connect to, and how to drive
  // the app once connected. Dense and top-left aligned — content, not a hero
  // (DESIGN §8). Shortcuts come from the single catalogue so this pane can never
  // advertise a binding the app doesn't have.
  import RotateCw from "@lucide/svelte/icons/rotate-cw";
  import Button from "$lib/components/ui/Button.svelte";
  import Kbd from "$lib/components/ui/Kbd.svelte";
  import Spinner from "$lib/components/ui/Spinner.svelte";
  import EmptyState from "$lib/components/ui/EmptyState.svelte";
  import BrandMark from "$lib/components/ui/BrandMark.svelte";
  import IconButton from "$lib/components/ui/IconButton.svelte";
  import ConnectionRow from "$lib/components/connections/ConnectionRow.svelte";
  import ConnectionForm from "$lib/components/connections/ConnectionForm.svelte";
  import { connections } from "$lib/stores/connections.svelte";
  import { connectErrorTitle } from "$lib/utils/connectionErrors";
  import { STARTUP_SHORTCUT_GROUPS } from "$lib/utils/shortcuts";

  let formOpen = $state(false);

  // The sidebar list normally loads these, but it isn't mounted while the
  // sidebar is collapsed (mod+b) — this pane can't depend on that.
  $effect(() => {
    void connections.load();
  });
</script>

<div class="h-full overflow-auto">
  <div class="flex max-w-2xl flex-col gap-4 pb-6">
    <EmptyState icon={BrandMark} iconSize={24} message="Connect to a database to start querying.">
      {#snippet action()}
        <Button size="sm" onclick={() => (formOpen = true)}>New connection</Button>
      {/snippet}
    </EmptyState>

    {#if !connections.loaded}
      <div class="flex items-center gap-2 px-3 text-sm text-fg-2"><Spinner size="sm" /> Loading…</div>
    {:else if connections.loadError}
      <div class="px-3 text-sm text-danger">
        Couldn't read your saved connections.
        <div class="mt-0.5 font-mono text-[11px] break-words opacity-90">
          {connections.loadError.message}
        </div>
        <div class="mt-2"><Button size="sm" onclick={() => connections.load()}>Retry</Button></div>
      </div>
    {:else if connections.profiles.length > 0}
      <section>
        <h2 class="px-3 pb-1 text-xs font-medium tracking-wider text-fg-2 uppercase">Connections</h2>
        <ul class="divide-y divide-border border-y border-border">
          {#each connections.profiles as p (p.id)}
            {@const st = connections.statusFor(p.id)}
            <li>
              <ConnectionRow profile={p} onclick={() => void connections.activate(p.id)} />
              {#if st.status === "error" && st.error}
                <div class="flex items-start gap-2 bg-danger-bg px-3 py-1.5 text-xs text-danger">
                  <div class="min-w-0 flex-1">
                    <div class="font-medium">{connectErrorTitle(st.error.kind)}</div>
                    <div class="mt-0.5 font-mono text-[11px] break-words opacity-90">
                      {st.error.message}
                    </div>
                  </div>
                  <IconButton
                    icon={RotateCw}
                    title="Retry"
                    size="sm"
                    onclick={() => connections.connect(p.id)}
                  />
                </div>
              {/if}
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    {#each STARTUP_SHORTCUT_GROUPS as group (group.title)}
      <section class="px-3">
        <h2 class="pb-1 text-xs font-medium tracking-wider text-fg-2 uppercase">{group.title}</h2>
        <div class="grid grid-cols-1 gap-x-8 gap-y-0.5 sm:grid-cols-2">
          {#each group.items as item (item.label)}
            <div class="flex h-6 items-center justify-between gap-3">
              <span class="flex min-w-0 items-center gap-2">
                <item.icon size={14} class="shrink-0 text-fg-2" />
                <span class="truncate text-xs text-fg-1">{item.label}</span>
              </span>
              <span class="flex shrink-0 items-center gap-1">
                {#each item.combos as combo (combo)}<Kbd {combo} />{/each}
              </span>
            </div>
          {/each}
        </div>
      </section>
    {/each}
  </div>
</div>

{#if formOpen}
  <ConnectionForm profile={null} onclose={() => (formOpen = false)} />
{/if}
