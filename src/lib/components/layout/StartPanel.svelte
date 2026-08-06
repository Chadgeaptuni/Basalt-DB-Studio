<script lang="ts">
  // The main pane before a session exists: what to connect to, and how to drive
  // the app once connected. Dense and top-left aligned — content, not a hero
  // (DESIGN §8). Shortcuts come from the single catalogue so this pane can never
  // advertise a binding the app doesn't have.
  import RotateCw from "@lucide/svelte/icons/rotate-cw";
  import Button from "$lib/components/ui/Button.svelte";
  import Kbd from "$lib/components/ui/Kbd.svelte";
  import Spinner from "$lib/components/ui/Spinner.svelte";
  import BrandMark from "$lib/components/ui/BrandMark.svelte";
  import IconButton from "$lib/components/ui/IconButton.svelte";
  import ConnectionRow from "$lib/components/connections/ConnectionRow.svelte";
  import ConnectionForm from "$lib/components/connections/ConnectionForm.svelte";
  import SearchIcon from "@lucide/svelte/icons/search";
  import { connections } from "$lib/stores/connections.svelte";
  import { palette } from "$lib/stores/palette.svelte";
  import { connectErrorTitle } from "$lib/utils/connectionErrors";
  import { STARTUP_SHORTCUT_GROUPS } from "$lib/utils/shortcuts";

  let formOpen = $state(false);

  // The Queries panel does not load these, and the Schema panel may be collapsed
  // (mod+b) — this pane cannot depend on either being mounted.
  $effect(() => {
    void connections.load();
  });
</script>

<!-- One gutter for the whole pane; sections never set their own horizontal padding,
     so every heading, row and card shares a single left edge (DESIGN §5). Vertical
     rhythm is the 4dp grid: 24 between sections, 8 under a heading, 24 above it. -->
<div class="h-full overflow-auto">
  <div class="flex max-w-2xl flex-col gap-6 px-6 py-6">
    <!-- Page intro, not an EmptyState: this block owns the pane's primary action
         and shares the pane gutter, where EmptyState carries its own padding for
         the panels it sits inside. -->
    <div class="flex flex-col items-start gap-4">
      <div class="flex items-center gap-2 text-body-md text-on-surface-variant">
        <BrandMark size={24} />
        <span>Connect to a database to start querying.</span>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="filled" size="sm" onclick={() => (formOpen = true)}>New connection</Button>
        <Button variant="text" size="sm" onclick={palette.show}>
          <SearchIcon size={14} strokeWidth={2} /> Search
          <Kbd combo="mod+k" />
        </Button>
      </div>
    </div>

    {#if !connections.loaded}
      <div class="flex items-center gap-2 text-body-md text-on-surface-muted">
        <Spinner size="sm" /> Loading…
      </div>
    {:else if connections.loadError}
      <div class="rounded-md bg-error-container p-4 text-body-md text-on-error-container">
        <div class="font-medium">Couldn't read your saved connections.</div>
        <div class="mt-1 text-data break-words opacity-90">
          {connections.loadError.message}
        </div>
        <!-- -ml-3 cancels the text button's own padding so its label sits on the
             same optical left edge as the heading above it. -->
        <div class="mt-4 -ml-3">
          <Button variant="text-error" size="sm" onclick={() => connections.load()}>Retry</Button>
        </div>
      </div>
    {:else if connections.profiles.length > 0}
      <section>
        <h2 class="pb-2 text-label-sm tracking-wider text-on-surface-muted uppercase">
          Connections
        </h2>
        <ul
          class="divide-y divide-outline-variant overflow-hidden rounded-md border
            border-outline-variant bg-surface-container-low"
        >
          {#each connections.profiles as p (p.id)}
            {@const st = connections.statusFor(p.id)}
            <li>
              <ConnectionRow profile={p} onclick={() => void connections.activate(p.id)} />
              {#if st.status === "error" && st.error}
                <div
                  class="flex items-start gap-3 bg-error-container px-3 py-2 text-body-sm
                    text-on-error-container"
                >
                  <div class="min-w-0 flex-1">
                    <div class="font-medium">{connectErrorTitle(st.error.kind)}</div>
                    <div class="mt-1 text-data break-words opacity-90">
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
      <section>
        <h2 class="pb-2 text-label-sm tracking-wider text-on-surface-muted uppercase">
          {group.title}
        </h2>
        <div class="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
          {#each group.items as item (item.label)}
            <div class="flex h-8 items-center justify-between gap-3">
              <span class="flex min-w-0 items-center gap-2">
                <item.icon size={14} class="shrink-0 text-on-surface-muted" />
                <span class="truncate text-body-sm text-on-surface-variant">{item.label}</span>
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
