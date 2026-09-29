<script lang="ts">
  import FolderOpen from "@lucide/svelte/icons/folder-open";
  import { open } from "@tauri-apps/plugin-dialog";
  import Field from "$lib/components/ui/Field.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import IconButton from "$lib/components/ui/IconButton.svelte";

  // A file path, typed or picked with the platform's own open dialog. Only the
  // path is kept — nothing is copied or read here.
  interface Props {
    label: string;
    value: string;
    placeholder?: string;
    hint?: string;
  }
  let { label, value = $bindable(), placeholder, hint }: Props = $props();

  async function browse(): Promise<void> {
    const picked = await open({ multiple: false, directory: false });
    if (typeof picked === "string") value = picked;
  }
</script>

<Field {label} {hint}>
  <div class="flex items-center gap-1">
    <div class="min-w-0 flex-1"><Input bind:value {placeholder} /></div>
    <IconButton icon={FolderOpen} title={`Choose ${label.toLowerCase()}…`} size="sm" onclick={browse} />
  </div>
</Field>
