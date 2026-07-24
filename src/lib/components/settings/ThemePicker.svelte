<script lang="ts">
  import Select, { type SelectOption } from "$lib/components/ui/Select.svelte";
  import { theme } from "$lib/stores/theme.svelte";

  // Preset picker (DESIGN §3 — presets only swap CSS variables). Label is the
  // preset name minus the `basalt-` prefix, title-cased.
  const options: SelectOption[] = theme.available.map((name) => ({
    value: name,
    label: name.replace("basalt-", "").replace(/^\w/, (c) => c.toUpperCase()),
  }));
</script>

<Select value={theme.current} {options} onchange={(v) => theme.set(v as typeof theme.current)} />
