<script lang="ts">
  import Modal from "$lib/components/ui/Modal.svelte";
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

  let name = $state(themeToEdit?.name ?? "Custom Theme");
  let primary = $state(themeToEdit?.colors.primary ?? DEFAULT_CUSTOM_COLORS.primary);
  let surface = $state(themeToEdit?.colors.surface ?? DEFAULT_CUSTOM_COLORS.surface);
  let border = $state(themeToEdit?.colors.border ?? DEFAULT_CUSTOM_COLORS.border);
  let text = $state(themeToEdit?.colors.text ?? DEFAULT_CUSTOM_COLORS.text);

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
    <label class="flex flex-col gap-1.5">
      <span class="text-xs font-semibold tracking-wider text-fg-2 uppercase">Theme Name</span>
      <Input value={name} oninput={(e) => (name = (e.target as HTMLInputElement).value)} />
    </label>

    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label class="flex items-center gap-3 rounded-lg border border-border bg-bg-0/60 p-3">
        <input
          type="color"
          bind:value={primary}
          class="h-8 w-10 cursor-pointer rounded border-0 bg-transparent"
        />
        <div class="flex flex-1 flex-col">
          <span class="text-xs font-medium text-fg-0">Primary Accent</span>
          <span class="font-mono text-[11px] text-fg-2">{primary}</span>
        </div>
      </label>

      <label class="flex items-center gap-3 rounded-lg border border-border bg-bg-0/60 p-3">
        <input
          type="color"
          bind:value={surface}
          class="h-8 w-10 cursor-pointer rounded border-0 bg-transparent"
        />
        <div class="flex flex-1 flex-col">
          <span class="text-xs font-medium text-fg-0">Surface Background</span>
          <span class="font-mono text-[11px] text-fg-2">{surface}</span>
        </div>
      </label>

      <label class="flex items-center gap-3 rounded-lg border border-border bg-bg-0/60 p-3">
        <input
          type="color"
          bind:value={border}
          class="h-8 w-10 cursor-pointer rounded border-0 bg-transparent"
        />
        <div class="flex flex-1 flex-col">
          <span class="text-xs font-medium text-fg-0">Border Color</span>
          <span class="font-mono text-[11px] text-fg-2">{border}</span>
        </div>
      </label>

      <label class="flex items-center gap-3 rounded-lg border border-border bg-bg-0/60 p-3">
        <input
          type="color"
          bind:value={text}
          class="h-8 w-10 cursor-pointer rounded border-0 bg-transparent"
        />
        <div class="flex flex-1 flex-col">
          <span class="text-xs font-medium text-fg-0">Text Color</span>
          <span class="font-mono text-[11px] text-fg-2">{text}</span>
        </div>
      </label>
    </div>
  </div>

  {#snippet footer()}
    <Button variant="secondary" size="sm" onclick={onclose}>Cancel</Button>
    <Button variant="primary" size="sm" disabled={!name.trim()} onclick={save}>Save Theme</Button>
  {/snippet}
</Modal>
