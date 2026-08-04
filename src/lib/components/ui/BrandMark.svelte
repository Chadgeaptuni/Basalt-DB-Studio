<script lang="ts">
  interface Props {
    size?: number | string;
    class?: string;
  }
  // Matches IconComponent's `size`/`class` so the mark drops into any ui slot
  // that takes a Lucide icon. Decorative: alt="" keeps it out of the a11y tree.
  let { size = 16, class: klass = "" }: Props = $props();
</script>

<img src="/icon-mark.svg" alt="" width={size} height={size} class={klass} draggable="false" />
