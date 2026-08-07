<script lang="ts">
  import { untrack } from "svelte";
  import Modal from "$lib/components/ui/Modal.svelte";
  import IconButton from "$lib/components/ui/IconButton.svelte";
  import Select, { type SelectOption } from "$lib/components/ui/Select.svelte";
  import NumberField from "$lib/components/ui/NumberField.svelte";
  import Kbd from "$lib/components/ui/Kbd.svelte";
  import ListItem from "$lib/components/ui/ListItem.svelte";
  import SettingRow from "./SettingRow.svelte";
  import SettingsGroup from "./SettingsGroup.svelte";
  import AboutTab from "./AboutTab.svelte";
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
  import Info from "@lucide/svelte/icons/info";
  import X from "@lucide/svelte/icons/x";

  interface Props {
    initialTab?: SettingsTab;
    onclose: () => void;
  }
  let { initialTab = "general", onclose }: Props = $props();

  // Seed only — the dialog is mounted per open, so later prop changes are moot.
  let activeTab = $state<SettingsTab>(untrack(() => initialTab));

  const SECTIONS = [
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

  // Pinned to the foot of the list, the way the nav rail pins Settings: About
  // reports on the app rather than configuring it, so it does not belong in the
  // run of preference panes above.
  const ABOUT = {
    id: "about",
    label: "About",
    icon: Info,
    blurb: "Version, build and device details for this install.",
  } as const;

  const current = $derived([...SECTIONS, ABOUT].find((d) => d.id === activeTab)!);

  const datetimeOptions: SelectOption[] = [
    { value: "stored", label: "As stored (raw)" },
    { value: "local", label: "Local time" },
    { value: "utc", label: "UTC" },
  ];
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

      {#each SECTIONS as dest (dest.id)}
        <ListItem
          headline={dest.label}
          icon={dest.icon}
          selected={activeTab === dest.id}
          onclick={() => (activeTab = dest.id)}
        />
      {/each}

      <div class="mt-auto border-t border-outline-variant pt-2">
        <ListItem
          headline={ABOUT.label}
          icon={ABOUT.icon}
          selected={activeTab === ABOUT.id}
          onclick={() => (activeTab = ABOUT.id)}
        />
      </div>
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
               and a second "General Preferences" title would just repeat it. One
               bordered list, hairlines between the rows — the border belongs to
               the group, not to each setting inside it. -->
          <SettingsGroup>
            <SettingRow
              label="Date and time display"
              hint="How timestamp columns are rendered in every data grid. Stored values are never rewritten."
            >
              {#snippet control(label)}
                <Select
                  {label}
                  value={settings.datetimeDisplay}
                  options={datetimeOptions}
                  onchange={(v) => settings.setDatetimeDisplay(v as DatetimeDisplay)}
                />
              {/snippet}
            </SettingRow>

            <SettingRow
              label="Default row limit"
              hint="Rows fetched per statement before the result is marked truncated."
            >
              {#snippet control(label)}
                <!-- Steps by 100: a fetch ceiling moves in hundreds, and a
                     stepper that takes 500 clicks to get anywhere is decoration.
                     Typing stays the way to reach an exact number. -->
                <NumberField
                  {label}
                  value={settings.defaultRowLimit}
                  min={1}
                  step={100}
                  onchange={settings.setDefaultRowLimit}
                />
              {/snippet}
            </SettingRow>
          </SettingsGroup>
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
        {:else if activeTab === "shortcuts"}
          <div class="flex flex-col gap-6">
            {#each SHORTCUT_GROUPS as group (group.title)}
              <SettingsGroup title={group.title}>
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
              </SettingsGroup>
            {/each}
          </div>
        {:else}
          <AboutTab />
        {/if}
      </div>
    </div>
  </div>
</Modal>
