<script lang="ts" module>
  export type SettingsTab = "general" | "appearance" | "shortcuts";
</script>

<script lang="ts">
  import { untrack } from "svelte";
  import Sliders from "@lucide/svelte/icons/sliders-horizontal";
  import Palette from "@lucide/svelte/icons/palette";
  import Keyboard from "@lucide/svelte/icons/keyboard";
  import X from "@lucide/svelte/icons/x";
  import Modal from "$lib/components/ui/Modal.svelte";
  import IconButton from "$lib/components/ui/IconButton.svelte";
  import Select, { type SelectOption } from "$lib/components/ui/Select.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import Kbd from "$lib/components/ui/Kbd.svelte";
  import ThemePicker from "./ThemePicker.svelte";
  import { settings } from "$lib/stores/settings.svelte";
  import { SHORTCUT_GROUPS } from "$lib/utils/shortcuts";
  import type { DatetimeDisplay } from "$lib/api/types";

  // Three destinations, one scroller: the nav and header stay put while only the
  // active pane scrolls, so the dialog can't outgrow the window (DESIGN §5/§6).
  interface Props {
    initialTab?: SettingsTab;
    onclose: () => void;
  }
  let { initialTab = "general", onclose }: Props = $props();

  // Seed only — the dialog is mounted per open, so later prop changes are moot.
  let activeTab = $state<SettingsTab>(untrack(() => initialTab));

  const DESTINATIONS = [
    { id: "general", label: "General", icon: Sliders, blurb: "Grid display and query defaults." },
    { id: "appearance", label: "Appearance", icon: Palette, blurb: "Theme for this device." },
    { id: "shortcuts", label: "Shortcuts", icon: Keyboard, blurb: "Every binding the app listens for." },
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

<Modal open title="Settings" size="3xl" headerHidden padding={false} {onclose}>
  <div class="flex min-h-0 flex-1">
    <nav class="flex w-44 shrink-0 flex-col border-r border-outline-variant bg-surface-container" aria-label="Settings sections">
      {#each DESTINATIONS as dest (dest.id)}
        <button
          type="button"
          aria-current={activeTab === dest.id}
          onclick={() => (activeTab = dest.id)}
          class="flex h-8 shrink-0 items-center gap-2 px-3 text-left text-xs transition-colors
            {activeTab === dest.id ? 'bg-surface-container-high text-on-surface' : 'text-on-surface-muted hover:bg-on-surface/8 hover:text-on-surface-variant'}"
        >
          <dest.icon size={14} class={activeTab === dest.id ? "text-primary" : "text-on-surface-muted"} />
          {dest.label}
        </button>
      {/each}
    </nav>

    <div class="flex min-w-0 flex-1 flex-col">
      <header class="flex h-9 shrink-0 items-center gap-2 border-b border-outline-variant px-3">
        <h2 class="text-sm font-medium text-on-surface">{current.label}</h2>
        <span class="min-w-0 truncate text-xs text-on-surface-muted">{current.blurb}</span>
        <div class="flex-1"></div>
        <IconButton icon={X} title="Close" size="sm" onclick={onclose} />
      </header>

      <div class="min-h-0 flex-1 overflow-auto p-4">
        {#if activeTab === "general"}
          <div class="divide-y divide-outline-variant border-y border-outline-variant">
            <label class="flex items-center gap-3 py-2">
              <span class="min-w-0 flex-1">
                <span class="block text-xs text-on-surface">Date-time display</span>
                <span class="block text-[11px] text-on-surface-muted">How timestamps render in data grids.</span>
              </span>
              <span class="w-44 shrink-0">
                <Select
                  value={settings.datetimeDisplay}
                  options={datetimeOptions}
                  onchange={(v) => settings.setDatetimeDisplay(v as DatetimeDisplay)}
                />
              </span>
            </label>
            <label class="flex items-center gap-3 py-2">
              <span class="min-w-0 flex-1">
                <span class="block text-xs text-on-surface">Default row limit</span>
                <span class="block text-[11px] text-on-surface-muted">Fetch ceiling per statement.</span>
              </span>
              <span class="w-44 shrink-0">
                <Input type="number" value={String(settings.defaultRowLimit)} oninput={setLimit} />
              </span>
            </label>
          </div>
        {:else if activeTab === "appearance"}
          <ThemePicker />
        {:else}
          <div class="flex flex-col gap-4">
            {#each SHORTCUT_GROUPS as group (group.title)}
              <section>
                <h3 class="pb-1 text-[11px] font-medium tracking-wider text-on-surface-muted uppercase">
                  {group.title}
                </h3>
                <div class="divide-y divide-outline-variant border-y border-outline-variant">
                  {#each group.items as item (item.label)}
                    <div class="flex h-7 items-center justify-between gap-3">
                      <span class="flex min-w-0 items-center gap-2">
                        <item.icon size={14} class="shrink-0 text-on-surface-muted" />
                        <span class="truncate text-xs text-on-surface-variant">{item.label}</span>
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
        {/if}
      </div>
    </div>
  </div>
</Modal>
