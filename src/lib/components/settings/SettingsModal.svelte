<script lang="ts">
  import Modal from "$lib/components/ui/Modal.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Select, { type SelectOption } from "$lib/components/ui/Select.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import ThemePicker from "./ThemePicker.svelte";
  import { settings } from "$lib/stores/settings.svelte";
  import type { DatetimeDisplay } from "$lib/api/types";

  // Flat settings list (DESIGN §7 — no accordions). Each control persists on
  // change; there's no Save/Cancel because changes are optimistic and local.
  interface Props {
    onclose: () => void;
  }
  let { onclose }: Props = $props();

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

<Modal open title="Settings" {onclose}>
  <div class="flex flex-col gap-4">
    <label class="flex flex-col gap-1">
      <span class="text-xs tracking-wider text-fg-2 uppercase">Theme</span>
      <ThemePicker />
    </label>

    <label class="flex flex-col gap-1">
      <span class="text-xs tracking-wider text-fg-2 uppercase">Datetime display</span>
      <Select
        value={settings.datetimeDisplay}
        options={datetimeOptions}
        onchange={(v) => settings.setDatetimeDisplay(v as DatetimeDisplay)}
      />
      <span class="text-[11px] text-fg-2">Transforms only how timestamps render — never the stored value.</span>
    </label>

    <label class="flex flex-col gap-1">
      <span class="text-xs tracking-wider text-fg-2 uppercase">Default row limit</span>
      <Input type="number" value={String(settings.defaultRowLimit)} oninput={setLimit} />
      <span class="text-[11px] text-fg-2">Fetch cap per run; the grid shows a “limit” badge when hit.</span>
    </label>
  </div>

  {#snippet footer()}
    <Button variant="primary" size="sm" onclick={onclose}>Done</Button>
  {/snippet}
</Modal>
