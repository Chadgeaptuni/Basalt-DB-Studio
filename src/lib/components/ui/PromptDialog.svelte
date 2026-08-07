<script lang="ts">
  import { untrack } from "svelte";
  import Modal from "./Modal.svelte";
  import Button from "./Button.svelte";
  import Field from "./Field.svelte";
  import Input from "./Input.svelte";

  // A dialog that asks for one value. `ConfirmDialog` covers yes/no; this covers
  // the next case up — a branch name, a remote URL — without every caller
  // hand-rolling a Modal with a field in it.
  //
  // Submitting is blocked on an empty value rather than accepted and rejected
  // later: there is nothing a caller could do with "" that it could not do with
  // the dialog still open.
  interface Props {
    title: string;
    label: string;
    hint?: string;
    placeholder?: string;
    initial?: string;
    confirmLabel?: string;
    onsubmit: (value: string) => void;
    onclose: () => void;
  }
  let {
    title,
    label,
    hint,
    placeholder,
    initial = "",
    confirmLabel = "Save",
    onsubmit,
    onclose,
  }: Props = $props();

  // Seed only: the dialog is mounted per open, so a later prop change is moot.
  let value = $state(untrack(() => initial));
  const valid = $derived(value.trim().length > 0);

  function submit(): void {
    if (!valid) return;
    onsubmit(value.trim());
    onclose();
  }
</script>

<Modal open {title} size="md" {onclose}>
  <!-- Enter submits: the dialog holds one field, so there is no ambiguity about
       what the key means, and reaching for the button would be the slow path. -->
  <div class="flex flex-col gap-4">
    <Field {label} {hint}>
      <Input bind:value {placeholder} autofocus onkeydown={(e) => e.key === "Enter" && submit()} />
    </Field>
  </div>

  {#snippet footer()}
    <Button variant="text" onclick={onclose}>Cancel</Button>
    <Button variant="filled" disabled={!valid} onclick={submit}>{confirmLabel}</Button>
  {/snippet}
</Modal>
