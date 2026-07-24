<script lang="ts">
  // Smart host: reads the toasts store and renders dumb Toast rows. Mounted once
  // in App.svelte (DESIGN §9).
  import { toasts } from "$lib/stores/toasts.svelte";
  import Toast from "$lib/components/ui/Toast.svelte";
</script>

<div class="pointer-events-none fixed right-3 bottom-3 z-[60] flex flex-col gap-2">
  {#each toasts.items as t (t.id)}
    <div class="pointer-events-auto">
      <Toast
        kind={t.kind}
        message={t.message}
        action={t.action}
        ondismiss={() => toasts.dismiss(t.id)}
      />
    </div>
  {/each}
</div>
