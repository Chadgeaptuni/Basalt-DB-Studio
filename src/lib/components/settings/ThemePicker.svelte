<script lang="ts">
  import Plus from "@lucide/svelte/icons/plus";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import Button from "$lib/components/ui/Button.svelte";
  import IconButton from "$lib/components/ui/IconButton.svelte";
  import ListItem from "$lib/components/ui/ListItem.svelte";
  import SegmentedButton, { type Segment } from "$lib/components/ui/SegmentedButton.svelte";
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

  <!-- Custom themes first: they are the user's own, and there are few of them. -->
  {#if theme.customThemes.length > 0}
    <section class="flex flex-col gap-1">
      <span class="text-label-sm tracking-wider text-on-surface-muted uppercase">Custom Themes</span>
      <div class="divide-y divide-outline-variant border-y border-outline-variant">
        {#each theme.customThemes as custom (custom.id)}
          <ListItem
            headline={custom.name}
            supporting="User custom theme"
            selected={theme.current === custom.id}
            flush
            onclick={() => theme.set(custom.id)}
          >
            {#snippet leading()}
              {@render swatch([custom.colors.primary, custom.colors.border], custom.colors.surface)}
            {/snippet}
            {#snippet trailing()}
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
            {/snippet}
          </ListItem>
        {/each}
      </div>
    </section>
  {/if}

  <!-- A palette per row rather than a card grid: 22 cards is a wall, and the only
       thing that distinguishes them is the swatch, which a row carries just as well. -->
  <section class="flex flex-col gap-1">
    <span class="text-label-sm tracking-wider text-on-surface-muted uppercase">Presets</span>
    <div class="divide-y divide-outline-variant border-y border-outline-variant">
      {#each THEME_DEFINITIONS as preset (preset.id)}
        <ListItem
          headline={preset.name}
          supporting={preset.description}
          selected={theme.current === preset.id}
          flush
          onclick={() => theme.set(preset.id)}
        >
          {#snippet leading()}
            {@render swatch(preset.colors.slice(1), preset.colors[0])}
          {/snippet}
        </ListItem>
      {/each}
    </div>
  </section>
</div>

{#snippet swatch(dots: string[], background: string)}
  <span
    class="flex h-6 w-9 shrink-0 items-center justify-center gap-1 rounded-xs border
      border-outline-variant"
    style="background-color: {background}"
    aria-hidden="true"
  >
    {#each dots as color, i (i)}
      <span class="h-3.5 w-1.5 rounded-full" style="background-color: {color}"></span>
    {/each}
  </span>
{/snippet}

{#if showEditorModal}
  <CustomThemeEditorModal
    themeToEdit={editingCustomTheme}
    onclose={() => (showEditorModal = false)}
    onsave={handleSaveCustom}
  />
{/if}
