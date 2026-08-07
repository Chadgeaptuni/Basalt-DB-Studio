<script lang="ts">
  import type { Snippet } from "svelte";
  import type { IconComponent } from "./icon";

  // The empty half of DESIGN §8, in the same two-line shape as `ErrorState`: what
  // is true, then what to do about it. One voice across all three states.
  //
  // The icon is off by default. Inside a rail panel it restates the rail icon two
  // inches away, which is decoration pretending to be information; it earns its
  // place only where the surface has no icon of its own.
  interface Props {
    icon?: IconComponent;
    /** Line-art glyphs read fine at 16; the brand mark needs ~24 to stay legible. */
    iconSize?: number;
    /** The state, in one short sentence. */
    message: string;
    /** The next step, if there is one worth naming. */
    hint?: string;
    /** At most one action (DESIGN §6/§8). Top-aligned, never a centered hero. */
    action?: Snippet;
  }

  let { icon: Icon, iconSize = 16, message, hint, action }: Props = $props();
</script>

<div class="flex flex-col items-start gap-1 px-3 py-4">
  <div class="flex items-center gap-2 text-body-md text-on-surface-variant">
    {#if Icon}<Icon size={iconSize} strokeWidth={2} class="shrink-0 text-on-surface-muted" />{/if}
    <span>{message}</span>
  </div>
  {#if hint}
    <span class="text-body-sm text-on-surface-muted">{hint}</span>
  {/if}
  {#if action}<div class="mt-2">{@render action()}</div>{/if}
</div>
