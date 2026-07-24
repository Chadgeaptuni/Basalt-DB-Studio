<script lang="ts">
  import type { Snippet } from "svelte";
  import type { IconComponent } from "./icon";

  interface Props {
    icon?: IconComponent;
    message: string;
    /** At most one action (DESIGN §6/§8). Top-aligned, never a centered hero. */
    action?: Snippet;
  }

  let { icon: Icon, message, action }: Props = $props();
</script>

<div class="flex flex-col items-start gap-2 p-3 text-sm text-fg-2">
  <div class="flex items-center gap-2">
    {#if Icon}<Icon size={16} strokeWidth={2} />{/if}
    <span>{message}</span>
  </div>
  {#if action}{@render action()}{/if}
</div>
