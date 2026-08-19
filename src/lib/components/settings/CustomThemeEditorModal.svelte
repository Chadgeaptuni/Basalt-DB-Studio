<script lang="ts">
  import Modal from "$lib/components/ui/Modal.svelte";
  import Field from "$lib/components/ui/Field.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import Badge from "$lib/components/ui/Badge.svelte";
  import type { CustomTheme } from "$lib/stores/theme.svelte";
  import { DEFAULT_CUSTOM_COLORS } from "$lib/stores/themeData";
  import { AA_BODY, contrastRatio } from "$lib/utils/contrast";

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

  // Live WCAG readout on the two pairs the user controls directly. A built-in
  // palette gets checked by the audit suite; a hand-picked one can only be
  // checked here. It reports rather than blocks: themeTokens lifts an
  // unreadable colour anyway, so the honest message is what will happen to it.
  const checks = $derived(
    [
      { label: "Text on surface", ratio: contrastRatio(text, surface) },
      { label: "Accent on surface", ratio: contrastRatio(primary, surface) },
    ].map((c) => ({ ...c, ok: c.ratio !== null && c.ratio >= AA_BODY })),
  );
  const anyLow = $derived(checks.some((c) => !c.ok));

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
          class="h-8 w-10 rounded-xs border-0 bg-transparent"
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
          class="h-8 w-10 rounded-xs border-0 bg-transparent"
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
          class="h-8 w-10 rounded-xs border-0 bg-transparent"
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
          class="h-8 w-10 rounded-xs border-0 bg-transparent"
        />
        <div class="flex flex-1 flex-col">
          <span class="text-label-md text-on-surface">Text Color</span>
          <span class="text-data text-on-surface-muted">{text}</span>
        </div>
      </label>
    </div>

    <div class="flex flex-col gap-2 rounded-md border border-outline-variant p-3">
      <span class="text-label-sm tracking-wider text-on-surface-muted uppercase">Readability</span>
      {#each checks as c (c.label)}
        <div class="flex items-center gap-2 text-body-sm text-on-surface-variant">
          <Badge variant={c.ok ? "ok" : "warn"}>{c.ok ? "AA" : "low"}</Badge>
          <span class="flex-1">{c.label}</span>
          <span class="text-data">{c.ratio === null ? "—" : `${c.ratio.toFixed(1)}:1`}</span>
        </div>
      {/each}
      {#if anyLow}
        <p class="text-body-sm text-on-surface-muted">
          WCAG AA wants {AA_BODY}:1 for body text. Basalt will lift the colours that fall short
          just far enough to clear it, so pick a stronger contrast if you want your exact hues.
        </p>
      {/if}
    </div>
  </div>

  {#snippet footer()}
    <Button variant="outlined" size="sm" onclick={onclose}>Cancel</Button>
    <Button variant="filled" size="sm" disabled={!name.trim()} onclick={save}>Save Theme</Button>
  {/snippet}
</Modal>
