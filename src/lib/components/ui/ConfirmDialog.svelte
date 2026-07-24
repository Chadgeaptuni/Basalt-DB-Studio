<script lang="ts">
  import Modal from "./Modal.svelte";
  import Button from "./Button.svelte";

  interface Props {
    title: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: "default" | "danger";
    onconfirm: () => void;
    oncancel: () => void;
  }

  let {
    title,
    message,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    variant = "default",
    onconfirm,
    oncancel,
  }: Props = $props();

  // The host mounts this only while a confirm is active, so open starts true;
  // scrim/Escape closes → treated as cancel.
  let open = $state(true);
</script>

<Modal {title} bind:open onclose={oncancel}>
  {#if message}<p class="text-fg-1">{message}</p>{/if}
  {#snippet footer()}
    <Button variant="ghost" onclick={oncancel}>{cancelLabel}</Button>
    <Button variant={variant === "danger" ? "danger" : "primary"} onclick={onconfirm}>
      {confirmLabel}
    </Button>
  {/snippet}
</Modal>
