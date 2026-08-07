<script lang="ts">
  // The empty workspace. It is centred rather than top-left aligned because there
  // is nothing on screen to align to: a dense block in the corner of an otherwise
  // empty 1200px pane reads as a rendering fault, not as density.
  //
  // The shape is VSCode's empty editor — the mark as a watermark, the keys that
  // drive the app underneath — and everything on it is functional: one sentence,
  // the connections that already exist, and a keyboard reference. No
  // illustration, no headline above `text-title-sm`, nothing here to fill space
  // (DESIGN §8). Shortcuts come from the single catalogue, so this pane can never
  // advertise a binding the app doesn't have.
  import RotateCw from "@lucide/svelte/icons/rotate-cw";
  import Button from "$lib/components/ui/Button.svelte";
  import Kbd from "$lib/components/ui/Kbd.svelte";
  import Spinner from "$lib/components/ui/Spinner.svelte";
  import BrandMark from "$lib/components/ui/BrandMark.svelte";
  import IconButton from "$lib/components/ui/IconButton.svelte";
  import ConnectionRow from "$lib/components/connections/ConnectionRow.svelte";
  import ConnectionForm from "$lib/components/connections/ConnectionForm.svelte";
  import ErrorState from "$lib/components/ui/ErrorState.svelte";
  import { connections } from "$lib/stores/connections.svelte";
  import { STARTUP_SHORTCUT_GROUPS } from "$lib/utils/shortcuts";

  let formOpen = $state(false);

  // The Queries panel does not load these, and the Schema panel may be collapsed
  // (mod+b) — this pane cannot depend on either being mounted.
  $effect(() => {
    void connections.load();
  });
</script>

<!-- `@container`, not a viewport breakpoint: this pane's width is the window
     minus the rail and whatever the side panel is doing, so `mod+b` alone can
     take it from two columns to one at a fixed window size. -->
<div class="@container h-full overflow-auto">
  <!-- `min-h-full` + `justify-center` centres on a tall window and scrolls on a
       short one, instead of centring content off the top edge. -->
  <div
    class="mx-auto flex min-h-full max-w-xl flex-col items-center justify-center gap-10 px-6 py-10"
  >
    <div class="flex flex-col items-center gap-5">
      <!-- A watermark, so it sits behind the reading rather than in front of it:
           at 20% the stack still resolves as a shape while every line of text on
           the pane outranks it. -->
      <BrandMark size={176} class="text-on-surface opacity-20 select-none" />
      <p class="text-title-sm text-on-surface-variant">Connect to a database to start querying.</p>
    </div>

    <!-- The connections you have, then the way to add one: with a list on screen
         the new-connection button is the alternative, not the instruction. -->
    <div class="flex w-full flex-col items-center gap-4">
      {#if !connections.loaded}
        <div class="flex items-center gap-2 text-body-md text-on-surface-muted">
          <Spinner size="sm" /> Loading…
        </div>
      {:else if connections.loadError}
        <div class="w-full overflow-hidden rounded-md">
          <ErrorState
            kind={connections.loadError.kind}
            message={connections.loadError.message}
            filled
          >
            {#snippet action()}
              <Button variant="text-error" size="sm" onclick={() => connections.load()}>
                Retry
              </Button>
            {/snippet}
          </ErrorState>
        </div>
      {:else if connections.profiles.length > 0}
        <ul
          class="w-full divide-y divide-outline-variant overflow-hidden rounded-md border
            border-outline-variant bg-surface-container-low"
        >
          {#each connections.profiles as p (p.id)}
            {@const st = connections.statusFor(p.id)}
            <li>
              <ConnectionRow profile={p} onclick={() => void connections.activate(p.id)} />
              {#if st.status === "error" && st.error}
                <ErrorState kind={st.error.kind} message={st.error.message} size="inline" filled>
                  {#snippet action()}
                    <IconButton
                      icon={RotateCw}
                      title="Retry"
                      size="sm"
                      onclick={() => connections.connect(p.id)}
                    />
                  {/snippet}
                </ErrorState>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}

      <Button variant="filled" size="sm" onclick={() => (formOpen = true)}>New connection</Button>
    </div>

    <!-- Reference, not navigation: nothing here is clickable, so it is the
         quietest thing on the pane. The rule running off each heading is what
         separates the two columns without a divider between them. -->
    <div class="grid w-full grid-cols-1 gap-x-8 gap-y-6 @2xl:grid-cols-2">
      {#each STARTUP_SHORTCUT_GROUPS as group (group.title)}
        <section>
          <h2
            class="flex items-center gap-3 pb-1 text-label-sm tracking-wider text-on-surface-muted
              uppercase"
          >
            {group.title}
            <span class="h-px flex-1 bg-outline-variant"></span>
          </h2>
          <ul>
            {#each group.items as item (item.label)}
              <li class="flex h-8 items-center justify-between gap-4">
                <span class="truncate text-body-sm text-on-surface-variant">{item.label}</span>
                <span class="flex shrink-0 items-center gap-1.5">
                  {#each item.combos as combo (combo)}<Kbd {combo} />{/each}
                </span>
              </li>
            {/each}
          </ul>
        </section>
      {/each}
    </div>
  </div>
</div>

{#if formOpen}
  <ConnectionForm profile={null} onclose={() => (formOpen = false)} />
{/if}
