<script lang="ts">
  import SettingsIcon from "@lucide/svelte/icons/settings";
  import NavRailItem from "./NavRailItem.svelte";
  import { panel } from "$lib/stores/panel.svelte";
  import { settingsDialog } from "$lib/stores/settingsDialog.svelte";
  import { DESTINATIONS } from "./destinations";

  // M3 navigation rail (DESIGN §5/§6): 64px, one 48px indicator per destination.
  // Narrower than M3's 80px and than the 72px this started at — the labels are
  // gone, so the rail only has to hold a 20px glyph and its state layer, and the
  // width it was reserving for two words of text is width the grid wants.
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
     because a <nav> may not itself carry an interactive role. Settings sits
     outside the tablist — it opens a dialog rather than selecting a panel, so
     joining the tabs' roving focus would make ArrowDown land on something that
     is not a destination. -->
<nav
  aria-label="Panels"
  class="flex w-16 shrink-0 flex-col items-center border-r border-outline-variant
    bg-surface-container py-2"
>
  <div
    bind:this={rail}
    role="tablist"
    aria-orientation="vertical"
    aria-label="Panels"
    class="flex w-full flex-1 flex-col items-center gap-1"
  >
    {#each DESTINATIONS as dest (dest.id)}
      {@const showing = panel.active === dest.id && !panel.collapsed}
      <NavRailItem
        icon={dest.icon}
        label={dest.label}
        active={showing}
        role="tab"
        aria-selected={showing}
        tabindex={panel.active === dest.id ? 0 : -1}
        onclick={() => panel.select(dest.id)}
        onkeydown={onKeydown}
      />
    {/each}
  </div>

  <!-- Bottom group: app-level actions, pinned below the destinations the way M3
       rails carry a trailing section. -->
  <div class="flex w-full shrink-0 flex-col items-center">
    <NavRailItem
      icon={SettingsIcon}
      label="Settings"
      onclick={() => settingsDialog.open("general")}
    />
  </div>
</nav>
