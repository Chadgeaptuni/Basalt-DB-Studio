<script lang="ts">
  import type { IconComponent } from "./icon";

  interface Props {
    icon: IconComponent;
    /** Required — doubles as tooltip and aria-label (DESIGN §6). */
    title: string;
    size?: "sm" | "md";
    disabled?: boolean;
    active?: boolean;
    onclick?: (e: MouseEvent) => void;
  }

  let { icon: Icon, title, size = "md", disabled = false, active = false, onclick }: Props =
    $props();

  const box = $derived(size === "sm" ? "h-6 w-6" : "h-7 w-7");
  const px = $derived(size === "sm" ? 14 : 16);
</script>

<button
  type="button"
  {title}
  aria-label={title}
  aria-pressed={active}
  {disabled}
  {onclick}
  class="inline-flex items-center justify-center rounded-md {box} transition-colors duration-150
    hover:bg-bg-2 hover:text-fg-0 disabled:opacity-50 disabled:pointer-events-none
    {active ? 'bg-bg-2 text-fg-0' : 'text-fg-1'}"
>
  <Icon size={px} strokeWidth={2} />
</button>
