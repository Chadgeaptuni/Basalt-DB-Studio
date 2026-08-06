<script lang="ts">
  import Modal from "$lib/components/ui/Modal.svelte";
  import Field from "$lib/components/ui/Field.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import type { CustomTheme } from "$lib/stores/theme.svelte";
  import { DEFAULT_CUSTOM_COLORS } from "$lib/stores/themeData";

  interface Props {
    themeToEdit?: CustomTheme | null;
    onclose: () => void;
    onsave: (theme: CustomTheme) => void;
  }

  let { themeToEdit = null, onclose, onsave }: Props = $props();

  let name = $state("");
  let primary = $state("");
  let surface = $state("");
  let border = $state("");
  let text = $state("");

  $effect(() => {
    name = themeToEdit?.name ?? "Custom Theme";
    primary = themeToEdit?.colors.primary ?? DEFAULT_CUSTOM_COLORS.primary;
    surface = themeToEdit?.colors.surface ?? DEFAULT_CUSTOM_COLORS.surface;
    border = themeToEdit?.colors.border ?? DEFAULT_CUSTOM_COLORS.border;
    text = themeToEdit?.colors.text ?? DEFAULT_CUSTOM_COLORS.text;
  });

  function save() {
    if (!name.trim()) return;
    const item: CustomTheme = {
      id: themeToEdit?.id ?? `custom-${Date.now()}`,
      name: name.trim(),
      colors: {
        primary,
        surface,
        border,
        text,
      },
    };
    onsave(item);
  }
</script>

<Modal open title={themeToEdit ? "Edit Custom Theme" : "Create Custom Theme"} size="lg" {onclose}>
  <div class="flex flex-col gap-4">
    <Field label="Theme Name">
      <Input value={name} oninput={(e) => (name = (e.target as HTMLInputElement).value)} />
    </Field>

    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label class="flex items-center gap-3 rounded-md border border-outline-variant bg-surface/60 p-3">
        <input
          type="color"
          aria-label="Primary Accent"
          bind:value={primary}
          class="h-8 w-10 cursor-pointer rounded-xs border-0 bg-transparent"
        />
        <div class="flex flex-1 flex-col">
          <span class="text-label-md text-on-surface">Primary Accent</span>
          <span class="text-data text-on-surface-muted">{primary}</span>
        </div>
      </label>

      <label class="flex items-center gap-3 rounded-md border border-outline-variant bg-surface/60 p-3">
        <input
          type="color"
          aria-label="Surface Background"
          bind:value={surface}
          class="h-8 w-10 cursor-pointer rounded-xs border-0 bg-transparent"
        />
        <div class="flex flex-1 flex-col">
          <span class="text-label-md text-on-surface">Surface Background</span>
          <span class="text-data text-on-surface-muted">{surface}</span>
        </div>
      </label>

      <label class="flex items-center gap-3 rounded-md border border-outline-variant bg-surface/60 p-3">
        <input
          type="color"
          aria-label="Border Color"
          bind:value={border}
          class="h-8 w-10 cursor-pointer rounded-xs border-0 bg-transparent"
        />
        <div class="flex flex-1 flex-col">
          <span class="text-label-md text-on-surface">Border Color</span>
          <span class="text-data text-on-surface-muted">{border}</span>
        </div>
      </label>

      <label class="flex items-center gap-3 rounded-md border border-outline-variant bg-surface/60 p-3">
        <input
          type="color"
          aria-label="Text Color"
          bind:value={text}
          class="h-8 w-10 cursor-pointer rounded-xs border-0 bg-transparent"
        />
        <div class="flex flex-1 flex-col">
          <span class="text-label-md text-on-surface">Text Color</span>
          <span class="text-data text-on-surface-muted">{text}</span>
        </div>
      </label>
    </div>
  </div>

  {#snippet footer()}
    <Button variant="outlined" size="sm" onclick={onclose}>Cancel</Button>
    <Button variant="filled" size="sm" disabled={!name.trim()} onclick={save}>Save Theme</Button>
  {/snippet}
</Modal>
