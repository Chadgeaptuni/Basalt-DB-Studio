<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import Plus from "@lucide/svelte/icons/plus";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import Button from "$lib/components/ui/Button.svelte";
  import IconButton from "$lib/components/ui/IconButton.svelte";
  import { confirm } from "$lib/stores/dialogs.svelte";
  import { theme, type CustomTheme } from "$lib/stores/theme.svelte";
  import { customCategory } from "$lib/stores/themeData";
  import { THEME_SECTIONS } from "./themeDefinitions";
  import CustomThemeEditorModal from "./CustomThemeEditorModal.svelte";

  // Three flat sections; a theme is one appearance, so picking a row is the whole
  // choice — no variant switch on top (DESIGN §3). Custom themes join the section
  // their authored surface puts them in.
  let editingCustomTheme = $state<CustomTheme | null>(null);
  let showEditorModal = $state(false);

  const sections = $derived(
    THEME_SECTIONS.map((section) => ({
      ...section,
      customs: theme.customThemes.filter((c) => customCategory(c.colors) === section.category),
    })),
  );

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

<div class="flex flex-col gap-3">
  <div class="flex items-center justify-between">
    <span class="text-xs text-on-surface-muted">{theme.current}</span>
    <Button size="sm" onclick={createNewTheme}><Plus size={13} /> New custom theme</Button>
  </div>

  {#each sections as section (section.category)}
    <section>
      <h4 class="pb-1 text-xs font-medium tracking-wider text-on-surface-muted uppercase">{section.title}</h4>
      <div class="grid grid-cols-1 border-t border-outline-variant sm:grid-cols-2">
        {#each section.items as preset, i (preset.id)}
          <button
            type="button"
            aria-pressed={theme.current === preset.id}
            onclick={() => theme.set(preset.id)}
            class="flex h-9 min-w-0 items-center gap-2 border-b border-outline-variant px-2 text-left
              transition-colors duration-200 ease-standard hover:bg-on-surface/8 {i % 2 === 0 ? 'sm:border-r' : ''}
              {theme.current === preset.id ? 'bg-surface-container text-on-surface' : 'text-on-surface-variant'}"
          >
            <span
              class="flex h-6 w-9 shrink-0 items-center justify-center gap-1 rounded-md border
                border-outline-variant p-1"
              style="background-color: {preset.colors[0]}"
              aria-hidden="true"
            >
              <span class="h-3.5 w-1.5 rounded-full" style="background-color: {preset.colors[1]}"></span>
              <span class="h-3.5 w-1.5 rounded-full" style="background-color: {preset.colors[2]}"></span>
            </span>
            <span class="min-w-0 flex-1 truncate text-xs font-medium">{preset.name}</span>
            {#if theme.current === preset.id}<Check size={14} class="shrink-0 text-primary" />{/if}
          </button>
        {/each}

        {#each section.customs as custom (custom.id)}
          <div class="flex h-9 items-center border-b border-outline-variant transition-colors hover:bg-on-surface/8">
            <button
              type="button"
              aria-pressed={theme.current === custom.id}
              onclick={() => theme.set(custom.id)}
              class="flex h-full min-w-0 flex-1 items-center gap-2 px-2 text-left"
            >
              <span
                class="flex h-6 w-9 shrink-0 items-center justify-center gap-1 rounded-md border
                  border-outline-variant p-1"
                style="background-color: {custom.colors.surface}"
                aria-hidden="true"
              >
                <span class="h-3.5 w-1.5 rounded-full" style="background-color: {custom.colors.primary}"></span>
                <span class="h-3.5 w-1.5 rounded-full" style="background-color: {custom.colors.border}"></span>
              </span>
              <span class="min-w-0 flex-1 truncate text-xs font-medium text-on-surface">{custom.name}</span>
              {#if theme.current === custom.id}<Check size={14} class="shrink-0 text-primary" />{/if}
            </button>
            <div class="flex shrink-0 items-center pr-1">
              <IconButton icon={Pencil} title={`Edit ${custom.name}`} size="sm" onclick={() => handleEditCustom(custom)} />
              <IconButton icon={Trash2} title={`Delete ${custom.name}`} size="sm" onclick={() => void handleDeleteCustom(custom)} />
            </div>
          </div>
        {/each}
      </div>
    </section>
  {/each}
</div>

{#if showEditorModal}
  <CustomThemeEditorModal
    themeToEdit={editingCustomTheme}
    onclose={() => (showEditorModal = false)}
    onsave={handleSaveCustom}
  />
{/if}
