<script lang="ts">
  import { keyboard } from "$lib/utils/keyboard";
  interface Props {
    combo: string;
  }
  let { combo }: Props = $props();
</script>

<kbd
  class="inline-flex h-4 items-center rounded border border-border bg-bg-2 px-1 font-mono
    text-[10px] leading-none text-fg-2"
>
  {keyboard.label(combo)}
</kbd>
