<script lang="ts">
  import Modal from "./Modal.svelte";

  let open = $state(false);
</script>

<button type="button" onclick={() => (open = true)}>Open modal</button>

<Modal bind:open title="Connection details">
  <input aria-label="Connection name" />
  <button type="button">Save</button>
</Modal>
