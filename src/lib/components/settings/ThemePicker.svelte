<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import Plus from "@lucide/svelte/icons/plus";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import Button from "$lib/components/ui/Button.svelte";
  import IconButton from "$lib/components/ui/IconButton.svelte";
  import SegmentedButton, { type Segment } from "$lib/components/ui/SegmentedButton.svelte";
  import { stateLayer, focusRing } from "$lib/components/ui/stateLayer";
  import { confirm } from "$lib/stores/dialogs.svelte";
  import { theme, THEME_VARIANTS, type CustomTheme, type ThemeVariant } from "$lib/stores/theme.svelte";
  import { THEME_DEFINITIONS } from "./themeDefinitions";
  import CustomThemeEditorModal from "./CustomThemeEditorModal.svelte";

  // Palette and variant are two independent choices: the segmented control sets
  // the appearance, the grid below sets the colours (DESIGN §3).
  let editingCustomTheme = $state<CustomTheme | null>(null);
  let showEditorModal = $state(false);

  const VARIANT_SEGMENTS: Segment[] = THEME_VARIANTS.map((v) => ({
    value: v,
    label: v === "amoled" ? "OLED" : v[0].toUpperCase() + v.slice(1),
  }));

  function createNewTheme(): void {
    editingCustomTheme = null;
    showEditorModal = true;
  }

  function handleEditCustom(item: CustomTheme): void {
    editingCustomTheme = item;
    showEditorModal = true;
  }

  async function handleDeleteCustom(item: CustomTheme): Promise<void> {
    const ok = await confirm({
      title: `Delete custom theme “${item.name}”?`,
      message: "The theme definition will be removed from this device.",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (ok) theme.deleteCustomTheme(item.id);
  }

  function handleSaveCustom(item: CustomTheme): void {
    const existing = theme.customThemes;
    const index = existing.findIndex((t) => t.id === item.id);
    const next = index >= 0 ? existing.with(index, item) : [...existing, item];
    theme.saveCustomThemes(next);
    theme.set(item.id);
    showEditorModal = false;
  }
</script>

<div class="flex flex-col gap-4">
  <!-- Variant Selector & Create Custom Theme Button -->
  <div
    class="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-outline-variant
      bg-surface/60 p-3"
  >
    <div class="flex items-center gap-2">
      <span class="text-label-sm tracking-wider text-on-surface-muted uppercase">Variant:</span>
      <SegmentedButton
        label="Theme variant"
        segments={VARIANT_SEGMENTS}
        value={theme.variant}
        onchange={(v) => theme.setVariant(v as ThemeVariant)}
      />
    </div>

    <Button size="sm" onclick={createNewTheme}>
      <Plus size={14} />
      Create Theme
    </Button>
  </div>

  <!-- Custom Themes Section (if any exist) -->
  {#if theme.customThemes.length > 0}
    <div class="flex flex-col gap-2">
      <span class="text-label-sm tracking-wider text-on-surface-muted uppercase">Custom Themes</span>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {#each theme.customThemes as custom (custom.id)}
          <!-- The card is a container, not a control: the edit/delete actions sit
               beside the select button rather than nested inside it. -->
          <div
            class="flex items-center gap-3 rounded-sm border p-3 transition-colors duration-200 ease-standard
              {theme.current === custom.id
              ? 'border-primary bg-surface-container text-on-surface'
              : 'border-outline-variant bg-surface text-on-surface-variant'}"
          >
            <button
              type="button"
              aria-pressed={theme.current === custom.id}
              onclick={() => theme.set(custom.id)}
              class="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-xs text-left
                {stateLayer} {focusRing}"
            >
              <span
                class="flex h-9 w-12 shrink-0 items-center justify-center rounded-xs border border-outline-variant p-1"
                style="background-color: {custom.colors.surface}"
                aria-hidden="true"
              >
                <span class="h-5 w-2 rounded-full" style="background-color: {custom.colors.primary}"></span>
                <span class="ml-1 h-5 w-2 rounded-full" style="background-color: {custom.colors.border}"></span>
              </span>
              <span class="min-w-0 flex-1">
                <span class="flex items-center gap-1 text-label-md text-on-surface">
                  <span class="truncate">{custom.name}</span>
                  {#if theme.current === custom.id}
                    <Check size={14} class="shrink-0 text-primary" />
                  {/if}
                </span>
                <span class="mt-0.5 block truncate text-body-sm text-on-surface-muted">User custom theme</span>
              </span>
            </button>
            <div class="flex shrink-0 items-center">
              <IconButton
                icon={Pencil}
                title={`Edit ${custom.name}`}
                size="sm"
                onclick={() => handleEditCustom(custom)}
              />
              <IconButton
                icon={Trash2}
                title={`Delete ${custom.name}`}
                size="sm"
                onclick={() => void handleDeleteCustom(custom)}
              />
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Presets Grid -->
  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {#each THEME_DEFINITIONS as preset (preset.id)}
      <button
        type="button"
        aria-pressed={theme.current === preset.id}
        onclick={() => theme.set(preset.id)}
        class="flex cursor-pointer items-center gap-3 rounded-sm border p-3 text-left
          {stateLayer} {focusRing}
          {theme.current === preset.id
          ? 'border-primary bg-surface-container text-on-surface'
          : 'border-outline-variant bg-surface text-on-surface-variant'}"
      >
        <span
          class="flex h-9 w-12 shrink-0 items-center justify-center gap-1 rounded-xs border
            border-outline-variant bg-surface p-1"
          aria-hidden="true"
        >
          {#each preset.colors as color, i (i)}
            <span class="h-5 w-2 rounded-full" style="background-color: {color}"></span>
          {/each}
        </span>
        <span class="min-w-0 flex-1">
          <span class="flex items-center gap-1.5 text-label-md text-on-surface">
            <span class="truncate">{preset.name}</span>
            {#if theme.current === preset.id}
              <Check size={14} class="shrink-0 text-primary" />
            {/if}
          </span>
          <span class="mt-0.5 block truncate text-body-sm text-on-surface-muted">{preset.description}</span>
        </span>
      </button>
    {/each}
  </div>
</div>

{#if showEditorModal}
  <CustomThemeEditorModal
    themeToEdit={editingCustomTheme}
    onclose={() => (showEditorModal = false)}
    onsave={handleSaveCustom}
  />
{/if}
