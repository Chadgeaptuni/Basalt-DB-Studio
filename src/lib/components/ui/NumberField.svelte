<script lang="ts">
  import ChevronUp from "@lucide/svelte/icons/chevron-up";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import type { IconComponent } from "./icon";
  import { FIELD_BOX } from "./field";
  import { stateLayer } from "./stateLayer";

  // A number field with steppers of our own, for the settings where stepping is
  // meaningful. It exists because the engine's spin buttons are the one control
  // in the app that never followed the theme — see `no-native-spinner` in
  // app.css for why they cannot.
  //
  // Not the same object as the status bar's zoom stepper, which looks similar and
  // is deliberately separate: its middle is a *reading* that resets on click, not
  // a value you can type into, and it steps a float through a fixed range. The
  // two share the idiom, not an implementation.
  interface Props {
    value: number;
    /** Accessible name. The field and both steppers derive theirs from it. */
    label: string;
    min?: number;
    /** Left open by default — most limits have no ceiling worth inventing. */
    max?: number;
    /** How much a stepper moves. Not the typing granularity. */
    step?: number;
    disabled?: boolean;
    id?: string;
    onchange: (value: number) => void;
  }

  let {
    value,
    label,
    min = 0,
    max,
    step = 1,
    disabled = false,
    id,
    onchange,
  }: Props = $props();

  const clamp = (n: number): number => Math.min(max ?? Infinity, Math.max(min, n));

  function commit(raw: string): void {
    const n = Number.parseInt(raw, 10);
    // A half-typed value ("", "-", "0" under a minimum of 1) is not a correction
    // to apply: the field goes on showing what was typed and the setting keeps
    // its last good number, rather than saving a value that cannot run.
    if (Number.isFinite(n) && n >= min && (max === undefined || n <= max)) onchange(n);
  }
</script>

<!-- `overflow-hidden` so the stepper column's square corners stay inside the box's
     radius. The wrapper carries the edge, so focus has to come from
     `focus-within` — the element that actually takes focus is the input inside. -->
<div
  class="{FIELD_BOX} flex items-center overflow-hidden border-outline-variant pl-3
    focus-within:outline-2 focus-within:-outline-offset-1 focus-within:outline-primary
    {disabled ? 'opacity-[0.38]' : ''}"
>
  <input
    {id}
    {min}
    {max}
    {step}
    {disabled}
    type="number"
    value={String(value)}
    aria-label={label}
    oninput={(e) => commit(e.currentTarget.value)}
    onblur={(e) => (e.currentTarget.value = String(value))}
    class="no-native-spinner min-w-0 flex-1 bg-transparent py-0 text-body-md text-on-surface
      outline-none"
  />

  {#snippet stepper(Icon: IconComponent, action: string, by: number, atEnd: boolean)}
    <button
      type="button"
      tabindex="-1"
      aria-label="{action} {label.toLowerCase()}"
      disabled={disabled || atEnd}
      onclick={() => onchange(clamp(value + by))}
      class="grid h-4 w-6 place-items-center text-on-surface-muted {stateLayer}"
    >
      <Icon size={12} strokeWidth={2.5} />
    </button>
  {/snippet}

  <!-- `tabindex="-1"` on both: a number input already steps on ArrowUp/ArrowDown,
       so from the keyboard these buttons are two extra tab stops onto an action
       the focused field performs. They are a pointer affordance. -->
  <div class="flex shrink-0 flex-col self-stretch border-l border-outline-variant">
    {@render stepper(ChevronUp, "Increase", step, max !== undefined && value >= max)}
    {@render stepper(ChevronDown, "Decrease", -step, value <= min)}
  </div>
</div>
