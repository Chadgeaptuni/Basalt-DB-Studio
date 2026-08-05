<script lang="ts">
  import Modal from "$lib/components/ui/Modal.svelte";
  import IconButton from "$lib/components/ui/IconButton.svelte";
  import Select, { type SelectOption } from "$lib/components/ui/Select.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import Kbd from "$lib/components/ui/Kbd.svelte";
  import ThemePicker from "./ThemePicker.svelte";
  import { THEME_DEFINITIONS } from "./themeDefinitions";
  import { settings } from "$lib/stores/settings.svelte";
  import { theme } from "$lib/stores/theme.svelte";
  import { SHORTCUT_GROUPS } from "$lib/utils/shortcuts";
  import type { DatetimeDisplay } from "$lib/api/types";

  // Icons
  import Palette from "@lucide/svelte/icons/palette";
  import Keyboard from "@lucide/svelte/icons/keyboard";
  import X from "@lucide/svelte/icons/x";

  type SettingsTab = "appearance" | "shortcuts";

  interface Props {
    onclose: () => void;
  }
  let { onclose }: Props = $props();

  let activeTab = $state<SettingsTab>("appearance");

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
  <div class="flex h-[680px] max-h-[88vh] w-full overflow-hidden rounded-lg bg-bg-2">
    <!-- Left Navigation Sidebar -->
    <nav class="flex w-56 shrink-0 flex-col gap-1 border-r border-border bg-bg-1/40 p-4">
      <span class="mb-3 px-3 pt-1 text-xs font-semibold tracking-wider text-fg-2 uppercase">
        Settings
      </span>

      <button
        type="button"
        onclick={() => (activeTab = "appearance")}
        class="flex cursor-pointer items-center gap-3 rounded-lg px-3.5 py-2.5 text-xs font-medium transition-colors
          {activeTab === 'appearance'
            ? 'bg-bg-1 font-semibold text-fg-0 border border-border/60'
            : 'text-fg-2 hover:bg-bg-1/40 hover:text-fg-1'}"
      >
        <Palette size={17} class={activeTab === 'appearance' ? 'text-accent' : 'text-fg-2'} />
        Appearance
      </button>

      <button
        type="button"
        onclick={() => (activeTab = "shortcuts")}
        class="flex cursor-pointer items-center gap-3 rounded-lg px-3.5 py-2.5 text-xs font-medium transition-colors
          {activeTab === 'shortcuts'
            ? 'bg-bg-1 font-semibold text-fg-0 border border-border/60'
            : 'text-fg-2 hover:bg-bg-1/40 hover:text-fg-1'}"
      >
        <Keyboard size={17} class={activeTab === 'shortcuts' ? 'text-accent' : 'text-fg-2'} />
        Shortcuts
      </button>
    </nav>

    <!-- Right Main Content Panel -->
    <div class="flex min-w-0 flex-1 flex-col bg-bg-2">
      <!-- Header Bar -->
      <header class="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h2 class="text-base font-semibold text-fg-0">
            {activeTab === "appearance" ? "Appearance" : "Shortcuts"}
          </h2>
          <p class="text-xs text-fg-2">
            {activeTab === "appearance"
              ? "Customize visual theme presets, variants, date-time formatting, and query limits."
              : "Keyboard shortcuts for quick navigation and control."}
          </p>
        </div>
        <IconButton icon={X} title="Close" size="sm" onclick={onclose} />
      </header>

      <!-- Scrollable Tab Content -->
      <div class="flex-1 overflow-y-auto p-6">
        {#if activeTab === "appearance"}
          <div class="flex flex-col gap-6">
            <!-- Theme Selection Section -->
            <section class="flex flex-col gap-3">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="text-xs font-semibold tracking-wider text-fg-2 uppercase">Themes & Variants</h3>
                  <p class="text-xs text-fg-2">Choose a color palette and display mode.</p>
                </div>
                <span class="rounded border border-border bg-bg-0 px-2 py-0.5 font-mono text-[11px] text-fg-2">
                  {THEME_DEFINITIONS.length + theme.customThemes.length} themes
                </span>
              </div>
              <ThemePicker />
            </section>

            <!-- General Preferences Section -->
            <section class="flex flex-col gap-4 border-t border-border pt-4">
              <div>
                <h3 class="text-xs font-semibold tracking-wider text-fg-2 uppercase">General Preferences</h3>
                <p class="text-xs text-fg-2">Configure default behavior for grid data display.</p>
              </div>

              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label class="flex flex-col gap-1.5 rounded-lg border border-border bg-bg-0/50 p-3.5">
                  <span class="text-xs font-medium text-fg-0">Date Time Display</span>
                  <Select
                    value={settings.datetimeDisplay}
                    options={datetimeOptions}
                    onchange={(v) => settings.setDatetimeDisplay(v as DatetimeDisplay)}
                  />
                  <span class="text-[11px] text-fg-2">Transforms timestamp rendering in data grids.</span>
                </label>

                <label class="flex flex-col gap-1.5 rounded-lg border border-border bg-bg-0/50 p-3.5">
                  <span class="text-xs font-medium text-fg-0">Default Row Limit</span>
                  <Input type="number" value={String(settings.defaultRowLimit)} oninput={setLimit} />
                  <span class="text-[11px] text-fg-2">Fetch ceiling per statement execution.</span>
                </label>
              </div>
            </section>
          </div>
        {:else if activeTab === "shortcuts"}
          <div class="flex flex-col gap-6">
            {#each SHORTCUT_GROUPS as group (group.title)}
              <section class="flex flex-col gap-2">
                <h3 class="text-[11px] font-semibold tracking-wider text-fg-2 uppercase">
                  {group.title}
                </h3>

                <div class="flex flex-col rounded-lg border border-border bg-bg-0/40 divide-y divide-border">
                  {#each group.items as item (item.label)}
                    <div class="flex items-center justify-between px-3.5 py-2.5">
                      <div class="flex items-center gap-3">
                        <item.icon size={15} class="text-fg-2 shrink-0" />
                        <span class="text-xs text-fg-1">{item.label}</span>
                      </div>
                      <div class="flex items-center gap-1">
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
