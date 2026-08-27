<script lang="ts">
  import PanelLeft from "@lucide/svelte/icons/panel-left";
  import Minus from "@lucide/svelte/icons/minus";
  import Plus from "@lucide/svelte/icons/plus";
  import IconButton from "$lib/components/ui/IconButton.svelte";
  import Badge from "$lib/components/ui/Badge.svelte";
  import Tooltip from "$lib/components/ui/Tooltip.svelte";
  import ConnectionLabel from "$lib/components/connections/ConnectionLabel.svelte";
  import { stateLayer, focusRing } from "$lib/components/ui/stateLayer";
  import { zoom } from "$lib/stores/zoom.svelte";
  import { keyboard } from "$lib/utils/keyboard";
  import { editorTabs } from "$lib/stores/tabs.svelte";
  import { panel } from "$lib/stores/panel.svelte";

  // Run state, all of it: which database the workspace points at, whether a
  // transaction is open, what the last statement cost. The top bar is navigation;
  // this bar is the state of the session (DESIGN §5).
  //
  // Three zones, and a new item goes in whichever one it belongs to — this bar
  // is going to grow, and "wherever it fit" is how a status bar turns into a
  // junk drawer:
  //
  //   leading  — how the workspace is set up: what is open, what it points at.
  //   session  — what is true about the statement that just ran. Everything here
  //              is conditional; the zone and its divider vanish together, so an
  //              idle bar has no empty scaffolding in it.
  //   trailing — controls for the view itself, not state. Right-aligned, and the
  //              last thing before the window edge.
  //
  // Hairlines between the zones, never gaps: at 32px there is no room to space
  // groups far enough apart to read as groups (DESIGN §2 — depth is contrast and
  // 1px lines).

  // Query stats for the active editor tab's shown statement.
  const tab = $derived(editorTabs.active);
  const stmt = $derived(tab && tab.result ? tab.result.statements[tab.activeStatement] : undefined);
  const tx = $derived(tab?.result?.txStatus ?? "idle");
  const stats = $derived(stmt && !stmt.error ? stmt : undefined);
</script>

{#snippet divider()}
  <span class="h-4 w-px shrink-0 bg-outline-variant"></span>
{/snippet}

<!-- Value bright, unit muted, and no punctuation between metrics: at a glance the
     numbers are what you are reading, and the words tell you which is which. -->
{#snippet metric(value: number, unit: string)}
  <span class="shrink-0 whitespace-nowrap text-on-surface-muted">
    <span class="text-on-surface-variant">{value}</span>&nbsp;{unit}
  </span>
{/snippet}

<footer
  class="flex h-8 shrink-0 items-center gap-2 border-t border-outline-variant bg-surface-container
    px-1 text-data text-on-surface-muted"
>
  <IconButton
    icon={PanelLeft}
    title={`Toggle panel · ${keyboard.label("mod+b")}`}
    size="sm"
    active={!panel.collapsed}
    onclick={panel.toggleCollapsed}
  />
  {@render divider()}
  <ConnectionLabel />

  {#if tx !== "idle" || stats}
    {@render divider()}
    <div class="flex min-w-0 items-center gap-3">
      {#if tx === "inTx"}
        <Badge variant="warn">TX</Badge>
      {:else if tx === "error"}
        <Badge variant="error">TX err</Badge>
      {/if}
      {#if stats}
        {#if stats.columns.length > 0}
          {@render metric(stats.rows.length, "rows")}
          <!-- The row limit is a badge rather than "(limit)" tacked onto the
               count: it means the answer on screen is incomplete, which is not a
               footnote to the number. -->
          {#if stats.truncated}<Badge variant="warn">limit</Badge>{/if}
        {:else}
          {@render metric(stats.rowsAffected, "affected")}
        {/if}
        {@render metric(stats.durationMs, "ms")}
      {/if}
    </div>
  {/if}

  <div class="flex-1"></div>

  <!-- Zoom: one instrument, not three loose controls. The well sinks it into the
       bar (DESIGN §2 tonal ladder) so − and + read as belonging to the reading
       between them, and the reading is a button in its own right — it is where
       the user's eye already is when they want to get back to 100%. -->
  <div class="flex h-7 shrink-0 items-center rounded-full bg-surface-container-low">
    <IconButton
      icon={Minus}
      title={`Zoom out · ${keyboard.label("mod+-")}`}
      size="sm"
      disabled={!zoom.canOut}
      onclick={zoom.out}
    />
    <Tooltip label={`Reset zoom · ${keyboard.label("mod+0")}`}>
      {#snippet children(tooltipProps)}
        <!-- Fixed width: the reading runs 50%–200%, and a bar that reflows every
             time you press + is worse than one that never does. -->
        <button
          {...tooltipProps}
          type="button"
          onclick={zoom.reset}
          class="h-7 w-11 rounded-full text-center text-on-surface-variant {stateLayer}
            {focusRing}"
        >
          {Math.round(zoom.level * 100)}%
        </button>
      {/snippet}
    </Tooltip>
    <IconButton
      icon={Plus}
      title={`Zoom in · ${keyboard.label("mod+=")}`}
      size="sm"
      disabled={!zoom.canIn}
      onclick={zoom.in}
    />
  </div>
</footer>
