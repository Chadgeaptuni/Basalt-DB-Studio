<script lang="ts">
  import { untrack } from "svelte";
  import Modal from "$lib/components/ui/Modal.svelte";
  import IconButton from "$lib/components/ui/IconButton.svelte";
  import Select, { type SelectOption } from "$lib/components/ui/Select.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import Kbd from "$lib/components/ui/Kbd.svelte";
  import ListItem from "$lib/components/ui/ListItem.svelte";
  import ThemePicker from "./ThemePicker.svelte";
  import { THEME_DEFINITIONS } from "./themeDefinitions";
  import { settings } from "$lib/stores/settings.svelte";
  import { theme } from "$lib/stores/theme.svelte";
  import { SHORTCUT_GROUPS } from "$lib/utils/shortcuts";
  import type { SettingsTab } from "$lib/stores/settingsDialog.svelte";
  import type { DatetimeDisplay } from "$lib/api/types";

  import Sliders from "@lucide/svelte/icons/sliders-horizontal";
  import Palette from "@lucide/svelte/icons/palette";
  import Keyboard from "@lucide/svelte/icons/keyboard";
  import X from "@lucide/svelte/icons/x";

  interface Props {
    initialTab?: SettingsTab;
    onclose: () => void;
  }
  let { initialTab = "general", onclose }: Props = $props();

  // Seed only — the dialog is mounted per open, so later prop changes are moot.
  let activeTab = $state<SettingsTab>(untrack(() => initialTab));

  const DESTINATIONS = [
    {
      id: "general",
      label: "General",
      icon: Sliders,
      blurb: "Defaults for how grid data is displayed and fetched.",
    },
    {
      id: "appearance",
      label: "Appearance",
      icon: Palette,
      blurb: "Customize visual theme presets, variants, and custom palettes.",
    },
    {
      id: "shortcuts",
      label: "Shortcuts",
      icon: Keyboard,
      blurb: "Keyboard shortcuts for quick navigation and control.",
    },
  ] as const;
  const current = $derived(DESTINATIONS.find((d) => d.id === activeTab)!);

  const datetimeOptions: SelectOption[] = [
    { value: "stored", label: "As stored (raw)" },
    { value: "local", label: "Local time" },
    { value: "utc", label: "UTC" },
  ];

  function setLimit(e: Event): void {
    const n = Number.parseInt((e.target as HTMLInputElement).value, 10);
    if (Number.isFinite(n) && n > 0) settings.setDefaultRowLimit(n);
  }
</script>

<Modal open title="Settings" size="4xl" headerHidden padding={false} {onclose}>
  <div class="flex h-[680px] max-h-[88vh] w-full overflow-hidden bg-surface-container-high">
    <!-- Left Navigation Sidebar -->
    <nav
      class="flex w-56 shrink-0 flex-col border-r border-outline-variant bg-surface-container py-2"
      aria-label="Settings sections"
    >
      <span class="px-3 pb-2 text-label-sm tracking-wider text-on-surface-muted uppercase">
        Settings
      </span>

      {#each DESTINATIONS as dest (dest.id)}
        <ListItem
          headline={dest.label}
          icon={dest.icon}
          selected={activeTab === dest.id}
          onclick={() => (activeTab = dest.id)}
        />
      {/each}
    </nav>

    <!-- Right Main Content Panel -->
    <div class="flex min-w-0 flex-1 flex-col">
      <!-- Header Bar -->
      <header
        class="flex shrink-0 items-center justify-between border-b border-outline-variant px-6 py-4"
      >
        <div class="min-w-0">
          <h2 class="text-title-md text-on-surface">{current.label}</h2>
          <p class="text-body-sm text-on-surface-muted">{current.blurb}</p>
        </div>
        <IconButton icon={X} title="Close" size="sm" onclick={onclose} />
      </header>

      <!-- Scrollable Tab Content -->
      <div class="min-h-0 flex-1 overflow-y-auto p-6">
        {#if activeTab === "general"}
          <!-- No section heading: the header bar above already names this pane,
               and a second "General Preferences" title would just repeat it. -->
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label class="flex flex-col gap-1.5 rounded-sm border border-outline-variant bg-surface/50 p-3.5">
              <span class="text-label-md text-on-surface">Date Time Display</span>
              <Select
                value={settings.datetimeDisplay}
                options={datetimeOptions}
                onchange={(v) => settings.setDatetimeDisplay(v as DatetimeDisplay)}
              />
              <span class="text-body-sm text-on-surface-muted">
                Transforms timestamp rendering in data grids.
              </span>
            </label>

            <label class="flex flex-col gap-1.5 rounded-sm border border-outline-variant bg-surface/50 p-3.5">
              <span class="text-label-md text-on-surface">Default Row Limit</span>
              <Input type="number" value={String(settings.defaultRowLimit)} oninput={setLimit} />
              <span class="text-body-sm text-on-surface-muted">Fetch ceiling per statement execution.</span>
            </label>
          </div>
        {:else if activeTab === "appearance"}
          <section class="flex flex-col gap-3">
            <div class="flex items-center justify-between gap-3">
              <div class="min-w-0">
                <h3 class="text-label-sm tracking-wider text-on-surface-muted uppercase">
                  Themes &amp; Variants
                </h3>
                <p class="text-body-sm text-on-surface-muted">Choose a color palette and display mode.</p>
              </div>
              <span
                class="shrink-0 rounded-xs border border-outline-variant bg-surface px-2 py-0.5
                  text-data text-on-surface-muted"
              >
                {THEME_DEFINITIONS.length + theme.customThemes.length} themes
              </span>
            </div>
            <ThemePicker />
          </section>
        {:else}
          <div class="flex flex-col gap-6">
            {#each SHORTCUT_GROUPS as group (group.title)}
              <section class="flex flex-col gap-2">
                <h3 class="text-label-sm tracking-wider text-on-surface-muted uppercase">
                  {group.title}
                </h3>

                <div
                  class="flex flex-col divide-y divide-outline-variant rounded-sm border
                    border-outline-variant bg-surface/40"
                >
                  {#each group.items as item (item.label)}
                    <div class="flex items-center justify-between gap-3 px-3.5 py-2.5">
                      <div class="flex min-w-0 items-center gap-3">
                        <item.icon size={15} class="shrink-0 text-on-surface-muted" />
                        <span class="truncate text-body-sm text-on-surface-variant">{item.label}</span>
                      </div>
                      <div class="flex shrink-0 items-center gap-1">
                        {#each item.combos as combo (combo)}<Kbd {combo} />{/each}
                      </div>
                    </div>
                  {/each}
                </div>
              </section>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
</Modal>
