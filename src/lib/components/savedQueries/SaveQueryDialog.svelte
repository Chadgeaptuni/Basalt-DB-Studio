<script lang="ts">
  import Modal from "$lib/components/ui/Modal.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Input from "$lib/components/ui/Input.svelte";
  import { saveQuery } from "$lib/stores/saveQuery.svelte";

  // Host for the "save query as" prompt (mounted once in App.svelte). Asks for a
  // folder-relative path; folders are created from `/` segments on the backend.
  let path = $state("");
  let saving = $state(false);
  let error = $state<string | null>(null);

  const invalid = $derived(() => {
    const p = path.trim();
    if (!p) return "Enter a name";
    if (p.startsWith("/") || p.includes("\\")) return "No leading slash or backslashes";
    if (p.split("/").some((s) => s === "" || s === "." || s === "..")) return "Invalid path segment";
    return null;
  });

  async function submit(): Promise<void> {
    const bad = invalid();
    if (bad) {
      error = bad;
      return;
    }
    saving = true;
    error = null;
    try {
      await saveQuery.confirmName(path.trim());
      path = "";
    } catch (e) {
      error = (e as Error).message;
    } finally {
      saving = false;
    }
  }
</script>

<Modal open title="Save query" onclose={() => saveQuery.cancel()}>
  <label class="flex flex-col gap-1">
    <span class="text-label-sm tracking-wider text-on-surface-muted uppercase">Name (folders with /)</span>
    <Input
      bind:value={path}
      placeholder="reports/daily-active"
      autofocus
      error={error ?? undefined}
      onkeydown={(e) => e.key === "Enter" && submit()}
    />
  </label>

  {#snippet footer()}
    <Button variant="ghost" size="sm" onclick={() => saveQuery.cancel()}>Cancel</Button>
    <Button variant="primary" size="sm" loading={saving} onclick={submit}>Save</Button>
  {/snippet}
</Modal>
