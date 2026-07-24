<script lang="ts">
  type Size = "sm" | "md" | "lg";
  interface Props {
    size?: Size;
    class?: string;
  }
  let { size = "md", class: cls = "" }: Props = $props();
  const px: Record<Size, number> = { sm: 12, md: 16, lg: 24 };
</script>

<svg
  class="animate-spin {cls}"
  width={px[size]}
  height={px[size]}
  viewBox="0 0 24 24"
  fill="none"
  aria-hidden="true"
>
  <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3" opacity="0.25" />
  <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
</svg>
