<script lang="ts" module>
  export interface Step {
    id: string;
    label: string;
  }
</script>

<script lang="ts">
  import Check from "@lucide/svelte/icons/check";

  // M3 stepper header: numbered steps with a connector, the current one filled and
  // completed ones checked. Read-only — the flow owns which step it is on and
  // whether the user may leave it, so the stepper never navigates by itself.
  interface Props {
    steps: Step[];
    /** Index of the step being shown. */
    current: number;
  }
  let { steps, current }: Props = $props();
</script>

<ol class="flex items-center gap-1" aria-label="Progress">
  {#each steps as step, i (step.id)}
    {@const done = i < current}
    {@const active = i === current}
    <li class="flex min-w-0 items-center gap-2" aria-current={active ? "step" : undefined}>
      <span
        class="grid h-6 w-6 shrink-0 place-items-center rounded-full text-label-sm
          {active
          ? 'bg-primary text-on-primary'
          : done
            ? 'bg-primary-container text-on-primary-container'
            : 'bg-surface-container-highest text-on-surface-muted'}"
      >
        {#if done}
          <Check size={14} strokeWidth={2} />
        {:else}
          {i + 1}
        {/if}
      </span>
      <span
        class="truncate text-label-md {active ? 'text-on-surface' : 'text-on-surface-muted'}"
      >
        {step.label}
      </span>
      {#if i < steps.length - 1}
        <span aria-hidden="true" class="mx-1 h-px w-6 shrink-0 bg-outline-variant"></span>
      {/if}
    </li>
  {/each}
</ol>
