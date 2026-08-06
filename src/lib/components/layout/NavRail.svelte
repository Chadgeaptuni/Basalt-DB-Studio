<script lang="ts">
  import { focusRing, stateLayerGroup } from "$lib/components/ui/stateLayer";
  import { panel } from "$lib/stores/panel.svelte";
  import { DESTINATIONS } from "./destinations";

  // M3 navigation rail (DESIGN §5/§6): 72px, one 56px block per destination —
  // a 32px pill indicator with the icon, label underneath.
  //
  // Arrow keys move between destinations without selecting, matching the ARIA
  // tablist pattern the rail implements; Enter/Space selects. Selecting the
  // destination that is already showing collapses the panel (see the store).
  let rail = $state<HTMLElement>();

  function onKeydown(e: KeyboardEvent): void {
    if (!(e.target instanceof HTMLElement) || !rail) return;
    const tabs = [...rail.querySelectorAll<HTMLElement>('[role="tab"]')];
    const current = tabs.indexOf(e.target);
    if (current === -1) return;
    let next: number | undefined;
    if (e.key === "ArrowDown") next = (current + 1) % tabs.length;
    else if (e.key === "ArrowUp") next = (current - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next === undefined) return;
    e.preventDefault();
    tabs[next].focus();
  }
</script>

<!-- `nav > div[role=tablist]`: the landmark and the widget are separate elements
     because a <nav> may not itself carry an interactive role. -->
<nav aria-label="Panels" class="shrink-0 border-r border-outline-variant bg-surface-container">
  <div
    bind:this={rail}
    role="tablist"
    aria-orientation="vertical"
    aria-label="Panels"
    class="flex h-full w-18 flex-col items-center gap-1 py-2"
  >
    {#each DESTINATIONS as dest (dest.id)}
      {@const showing = panel.active === dest.id && !panel.collapsed}
      <button
        type="button"
        role="tab"
        aria-selected={showing}
        tabindex={panel.active === dest.id ? 0 : -1}
        title={dest.label}
        onclick={() => panel.select(dest.id)}
        onkeydown={onKeydown}
        class="group flex h-14 w-full shrink-0 flex-col items-center justify-center gap-1
          text-label-sm {focusRing}
          {showing ? 'text-on-surface' : 'text-on-surface-variant'}"
      >
        <!-- The indicator is the pill, not the icon colour: M3 marks the active
             destination with a filled 56×32 container so it reads without relying
             on colour alone. -->
        <span
          class="grid h-8 w-14 place-items-center rounded-full transition-colors duration-200
            ease-standard {showing
            ? 'bg-secondary-container text-on-secondary-container'
            : stateLayerGroup}"
        >
          <dest.icon size={18} strokeWidth={2} />
        </span>
        {dest.label}
      </button>
    {/each}
  </div>
</nav>
