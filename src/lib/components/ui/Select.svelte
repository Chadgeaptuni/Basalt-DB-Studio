<script lang="ts" module>
  export interface SelectOption {
    value: string;
    label: string;
  }
</script>

<script lang="ts">
  import { Select } from "bits-ui";
  import Check from "@lucide/svelte/icons/check";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import { FIELD_BOX } from "./field";
  import { MENU_ROW, POPOVER_SURFACE } from "./menu";
  import { stateLayer, focusRing } from "./stateLayer";
  import { popIn, popOut } from "$lib/utils/motion";

  // The app's one dropdown. It was a native `<select>`, which is the one control
  // the browser refuses to theme: the popup came from the OS in the OS's colours,
  // so on every theme but the platform default it opened as a white rectangle
  // over a dark app. This renders its own listbox on the shared popup surface,
  // so it matches the menus it sits beside and follows the theme like everything
  // else.
  //
  // `label` is required and not optional-with-a-fallback: the trigger is a button
  // whose text is the *selected value*, so without it every screen reader hears
  // "Local time, button" with no clue what it sets. A wrapping `<label>` does not
  // fix that — native labels name labelable elements, and the accessible name of
  // a button comes from its contents.
  interface Props {
    value?: string;
    options: SelectOption[];
    /** Accessible name for the trigger. Required — see above. */
    label: string;
    /** Shown when `value` matches no option; a placeholder is not a value. */
    placeholder?: string;
    disabled?: boolean;
    id?: string;
    onchange?: (value: string) => void;
  }

  let {
    value = $bindable(""),
    options,
    label,
    placeholder = "Select…",
    disabled = false,
    id,
    onchange,
  }: Props = $props();

  // Resolved here rather than through `Select.Value`: an option may legitimately
  // carry the empty string (a connection's environment is "untagged" that way),
  // and to bits-ui an empty value is an empty selection.
  const selected = $derived(options.find((o) => o.value === value));
</script>

<!-- `allowDeselect={false}`: clicking the current row is how a user confirms a
     choice, not how they clear it. Nothing here has a meaningful empty state that
     isn't already an option in the list — "Untagged" is a row, not the absence
     of one. -->
<Select.Root
  type="single"
  bind:value
  {disabled}
  items={options}
  loop
  allowDeselect={false}
  onValueChange={(v) => onchange?.(v)}
>
  <Select.Trigger
    {id}
    aria-label={label}
    class="{FIELD_BOX} group flex items-center gap-2 border-outline-variant px-3
      {stateLayer} {focusRing}"
  >
    <span
      class="min-w-0 flex-1 truncate text-left {selected
        ? 'text-on-surface'
        : 'text-on-surface-muted'}"
    >
      {selected?.label ?? placeholder}
    </span>
    <ChevronDown
      size={14}
      strokeWidth={2}
      class="shrink-0 text-on-surface-muted transition-transform duration-200 ease-standard
        group-data-[state=open]:rotate-180"
    />
  </Select.Trigger>

  <Select.Portal>
    <!-- Matched to the trigger's width but never narrower than a menu: a listbox
         that is half the width of the control it belongs to reads as a different
         object. `max-h` keeps a long list inside the window instead of running
         off the bottom edge.

         bits-ui measures the anchor width in device px, and the surface it is
         used on is zoomed (`app-zoom`), so it has to be divided back down or the
         listbox comes out `zoom`× wider than the control it belongs to. -->
    <Select.Content sideOffset={4} align="start" forceMount>
      <!-- `forceMount` + `child` so the listbox has an exit to animate; see
           `ContextMenu` for the full reasoning. -->
      {#snippet child({ wrapperProps, props, open })}
        {#if open}
          <div {...wrapperProps}>
            <div
              {...props}
              class="{POPOVER_SURFACE} max-h-64 min-w-44 py-2
                w-[calc(var(--bits-select-anchor-width)/var(--ui-zoom,1))]"
              in:popIn
              out:popOut
            >
              <Select.Viewport>
                {#each options as opt (opt.value)}
                  <Select.Item
                    value={opt.value}
                    label={opt.label}
                    class="{MENU_ROW} text-on-surface-variant data-[selected]:text-on-surface"
                  >
                    {#snippet children({ selected: isSelected })}
                      <!-- Fixed slot whether or not this row is the current value,
                           so labels align — same shape as `MenuRow`'s check. -->
                      <span class="grid w-4 shrink-0 place-items-center">
                        {#if isSelected}
                          <Check size={14} strokeWidth={2} class="text-primary" />
                        {/if}
                      </span>
                      <span class="min-w-0 flex-1 truncate">{opt.label}</span>
                    {/snippet}
                  </Select.Item>
                {/each}
              </Select.Viewport>
            </div>
          </div>
        {/if}
      {/snippet}
    </Select.Content>
  </Select.Portal>
</Select.Root>
