<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import Plus from "@lucide/svelte/icons/plus";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import Button from "$lib/components/ui/Button.svelte";
  import IconButton from "$lib/components/ui/IconButton.svelte";
  import { confirm } from "$lib/stores/dialogs.svelte";
  import { theme, THEME_VARIANTS, type CustomTheme } from "$lib/stores/theme.svelte";
  import { THEME_DEFINITIONS } from "./themeDefinitions";
  import CustomThemeEditorModal from "./CustomThemeEditorModal.svelte";

  let editingCustomTheme = $state<CustomTheme | null>(null);
  let showEditorModal = $state(false);

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

<div class="flex flex-col gap-3">
  <div class="flex min-h-9 flex-wrap items-center justify-between gap-2 border-y border-border py-1">
    <div class="flex items-center gap-2">
      <span class="text-xs font-medium tracking-wider text-fg-2 uppercase">Variant</span>
      <div class="flex items-center gap-0.5" role="group" aria-label="Theme variant">
        {#each THEME_VARIANTS as v}
          <button
            type="button"
            aria-pressed={theme.variant === v}
            onclick={() => theme.setVariant(v)}
            class="h-6 rounded-md px-2 text-xs font-medium uppercase transition-colors duration-150
              {theme.variant === v
                ? 'bg-bg-2 text-fg-0'
                : 'text-fg-2 hover:bg-bg-1 hover:text-fg-1'}"
          >
            {v === "amoled" ? "OLED" : v}
          </button>
        {/each}
      </div>
    </div>

    <Button size="sm" onclick={createNewTheme}><Plus size={13} /> New custom theme</Button>
  </div>

  {#if theme.customThemes.length > 0}
    <div class="flex flex-col gap-2">
      <h4 class="text-xs font-medium tracking-wider text-fg-2 uppercase">Custom themes</h4>
      <div class="divide-y divide-border border-y border-border">
        {#each theme.customThemes as custom (custom.id)}
          <div class="flex h-11 items-center transition-colors hover:bg-bg-1">
            <button
              type="button"
              aria-pressed={theme.current === custom.id}
              onclick={() => theme.set(custom.id)}
              class="flex h-full min-w-0 flex-1 items-center gap-2 px-2 text-left"
            >
              <span
                class="flex h-7 w-10 shrink-0 items-center justify-center rounded-md border border-border p-1"
                style="background-color: {custom.colors.surface}"
                aria-hidden="true"
              >
                <span class="h-4 w-1.5 rounded-full" style="background-color: {custom.colors.primary}"></span>
                <span class="ml-1 h-4 w-1.5 rounded-full" style="background-color: {custom.colors.border}"></span>
              </span>
              <span class="min-w-0 flex-1 truncate text-xs font-medium text-fg-0">{custom.name}</span>
              {#if theme.current === custom.id}<Check size={14} class="shrink-0 text-accent" />{/if}
            </button>
            <div class="flex shrink-0 items-center pr-1">
              <IconButton icon={Pencil} title={`Edit ${custom.name}`} size="sm" onclick={() => handleEditCustom(custom)} />
              <IconButton icon={Trash2} title={`Delete ${custom.name}`} size="sm" onclick={() => void handleDeleteCustom(custom)} />
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <div class="flex flex-col gap-2">
    <h4 class="text-xs font-medium tracking-wider text-fg-2 uppercase">Presets</h4>
    <div class="grid grid-cols-1 border-y border-border sm:grid-cols-2">
      {#each THEME_DEFINITIONS as preset, i (preset.id)}
        <button
          type="button"
          aria-pressed={theme.current === preset.id}
          onclick={() => theme.set(preset.id)}
          class="flex h-11 min-w-0 items-center gap-2 border-b border-border px-2 text-left
            transition-colors duration-150 hover:bg-bg-1 {i % 2 === 0 ? 'sm:border-r' : ''}
            {theme.current === preset.id ? 'bg-bg-1 text-fg-0' : 'text-fg-1'}"
        >
          <span class="flex h-7 w-10 shrink-0 items-center justify-center gap-1 rounded-md border border-border bg-bg-0 p-1" aria-hidden="true">
            {#each preset.colors as color}
              <span class="h-4 w-1.5 rounded-full" style="background-color: {color}"></span>
            {/each}
          </span>
          <span class="min-w-0 flex-1">
            <span class="flex items-center gap-1 text-xs font-medium text-fg-0">
              <span class="truncate">{preset.name}</span>
              {#if theme.current === preset.id}<Check size={14} class="shrink-0 text-accent" />{/if}
            </span>
            <span class="block truncate text-[11px] text-fg-2">{preset.description}</span>
          </span>
        </button>
      {/each}
    </div>
  </div>
</div>

{#if showEditorModal}
  <CustomThemeEditorModal
    themeToEdit={editingCustomTheme}
    onclose={() => (showEditorModal = false)}
    onsave={handleSaveCustom}
  />
{/if}
