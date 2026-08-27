<script lang="ts">
  // The Postgres engine glyph, drawn here rather than imported: Lucide has a
  // feather (SQLite's own mark) and a fish (near enough to MySQL's dolphin at
  // 14px) but no elephant, and the official Slonik is a registered trademark of
  // the PostgreSQL Community Association of Canada carrying a fixed palette —
  // DESIGN §1 exempts only the brand mark's three asset paths from the colour
  // tokens, and "logo-like" is named there as not a reason. Built to Lucide's
  // conventions (24×24, stroke 2, round caps, `currentColor`) so it sits beside
  // them in a tree row without reading as a second icon set.
  interface Props {
    size?: number | string;
    strokeWidth?: number | string;
    color?: string;
    class?: string;
  }

  let {
    size = 24,
    strokeWidth = 2,
    color = "currentColor",
    class: className = "",
  }: Props = $props();
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke={color}
  stroke-width={strokeWidth}
  stroke-linecap="round"
  stroke-linejoin="round"
  class={className}
  aria-hidden="true"
>
  <path d="M8 6a4 4 0 0 1 8 0v5a4 4 0 0 1-8 0z" />
  <path d="M8 7H6.5a3.5 3.5 0 0 0 0 7H8" />
  <path d="M16 7h1.5a3.5 3.5 0 0 1 0 7H16" />
  <path d="M12 15v3a2 2 0 0 0 4 0v-1" />
  <circle cx="10.2" cy="8.6" r=".8" fill={color} stroke="none" />
  <circle cx="13.8" cy="8.6" r=".8" fill={color} stroke="none" />
</svg>
