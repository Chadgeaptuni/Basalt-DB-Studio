<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import Plus from "@lucide/svelte/icons/plus";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import { theme, THEME_VARIANTS, type CustomTheme } from "$lib/stores/theme.svelte";
  import { THEME_DEFINITIONS } from "./themeDefinitions";
  import CustomThemeEditorModal from "./CustomThemeEditorModal.svelte";

  let editingCustomTheme = $state<CustomTheme | null>(null);
  let showEditorModal = $state(false);

  function createNewTheme() {
    editingCustomTheme = null;
    showEditorModal = true;
  }

  function handleEditCustom(item: CustomTheme, e: Event) {
    e.stopPropagation();
    editingCustomTheme = item;
    showEditorModal = true;
  }

  function handleDeleteCustom(id: string, e: Event) {
    e.stopPropagation();
    theme.deleteCustomTheme(id);
  }

  function handleSaveCustom(item: CustomTheme) {
    const existing = theme.customThemes;
    const index = existing.findIndex((t) => t.id === item.id);
    let next: CustomTheme[];
    if (index >= 0) {
      next = [...existing];
      next[index] = item;
    } else {
      next = [...existing, item];
    }
    theme.saveCustomThemes(next);
    theme.set(item.id);
    showEditorModal = false;
  }
</script>

<div class="flex flex-col gap-4">
  <!-- Variant Selector & Create Custom Theme Button -->
  <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-bg-0/60 p-3">
    <div class="flex items-center gap-2">
      <span class="text-xs font-semibold tracking-wider text-fg-2 uppercase">Variant:</span>
      <div class="flex items-center gap-1 rounded-md bg-bg-1 p-0.5 border border-border">
        {#each THEME_VARIANTS as v}
          <button
            type="button"
            onclick={() => theme.setVariant(v)}
            class="cursor-pointer rounded px-2.5 py-1 text-xs font-medium transition-colors uppercase
              {theme.variant === v
                ? 'bg-accent text-accent-fg font-semibold'
                : 'text-fg-2 hover:text-fg-1'}"
          >
            {v === "amoled" ? "OLED" : v}
          </button>
        {/each}
      </div>
    </div>

    <button
      type="button"
      onclick={createNewTheme}
      class="flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-bg-1 px-3 py-1.5 text-xs font-medium text-fg-0 transition-colors hover:border-accent hover:text-accent"
    >
      <Plus size={14} />
      Create Theme
    </button>
  </div>

  <!-- Custom Themes Section (if any exist) -->
  {#if theme.customThemes.length > 0}
    <div class="flex flex-col gap-2">
      <span class="text-xs font-semibold tracking-wider text-fg-2 uppercase">Custom Themes</span>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {#each theme.customThemes as custom (custom.id)}
          <div
            role="button"
            tabindex="0"
            onclick={() => theme.set(custom.id)}
            onkeydown={(e) => e.key === 'Enter' && theme.set(custom.id)}
            class="flex items-center gap-3 rounded-lg border p-3 text-left transition-colors cursor-pointer
              {theme.current === custom.id
                ? 'border-accent bg-bg-1 text-fg-0'
                : 'border-border bg-bg-0 text-fg-1 hover:border-border-strong hover:bg-bg-1/60'}"
          >
            <span class="flex h-9 w-12 shrink-0 items-center justify-center rounded border border-border p-1" style="background-color: {custom.colors.surface}">
              <span class="h-5 w-2 rounded-full" style="background-color: {custom.colors.primary}"></span>
              <span class="ml-1 h-5 w-2 rounded-full" style="background-color: {custom.colors.border}"></span>
            </span>
            <span class="min-w-0 flex-1">
              <span class="flex items-center gap-1 text-xs font-semibold text-fg-0">
                <span class="truncate">{custom.name}</span>
                {#if theme.current === custom.id}
                  <Check size={14} class="shrink-0 text-accent" />
                {/if}
              </span>
              <span class="mt-0.5 block truncate text-[11px] text-fg-2">User custom theme</span>
            </span>
            <div class="flex items-center gap-1">
              <button
                type="button"
                title="Edit theme"
                onclick={(e) => handleEditCustom(custom, e)}
                class="cursor-pointer p-1 text-fg-2 hover:text-fg-0"
              >
                <Pencil size={13} />
              </button>
              <button
                type="button"
                title="Delete theme"
                onclick={(e) => handleDeleteCustom(custom.id, e)}
                class="cursor-pointer p-1 text-fg-2 hover:text-danger"
              >
                <Trash2 size={13} />
              </button>
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
        onclick={() => theme.set(preset.id)}
        class="flex items-center gap-3 rounded-lg border p-3 text-left transition-colors cursor-pointer
          {theme.current === preset.id
            ? 'border-accent bg-bg-1 text-fg-0'
            : 'border-border bg-bg-0 text-fg-1 hover:border-border-strong hover:bg-bg-1/60'}"
      >
        <span class="flex h-9 w-12 shrink-0 items-center justify-center gap-1 rounded border border-border bg-bg-0 p-1">
          {#each preset.colors as color}
            <span class="h-5 w-2 rounded-full" style="background-color: {color}"></span>
          {/each}
        </span>
        <span class="min-w-0 flex-1">
          <span class="flex items-center gap-1.5 text-xs font-semibold text-fg-0">
            <span class="truncate">{preset.name}</span>
            {#if theme.current === preset.id}
              <Check size={14} class="shrink-0 text-accent" />
            {/if}
          </span>
          <span class="mt-0.5 block truncate text-[11px] text-fg-2">{preset.description}</span>
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
