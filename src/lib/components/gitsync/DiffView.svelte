<script lang="ts">
  import { parseDiff } from "$lib/utils/diff";

  // A unified diff. Shared by the working-tree file view and the commit file
  // view, which differ only in where the text came from.
  //
  // Two gutters of line numbers rather than one: in a hunk the old and new files
  // are at different lines, and a single column has to lie about one of them.
  interface Props {
    /** Raw `git diff` output. */
    raw: string;
  }
  let { raw }: Props = $props();

  const diff = $derived(parseDiff(raw));

  // The row's tint. Additions and removals are the `ok`/`error` roles at low
  // alpha — the tokens already carry each theme's idea of "added" and "removed",
  // and a green that ignores the palette is the thing DESIGN §3 exists to stop.
  const ROW: Record<string, string> = {
    add: "bg-ok/10 text-on-surface",
    remove: "bg-error/10 text-on-surface",
    context: "text-on-surface-variant",
    meta: "bg-surface-container text-on-surface-muted",
  };
  const MARK: Record<string, string> = { add: "+", remove: "−", context: " ", meta: " " };
</script>

{#if diff.binary}
  <p class="p-3 text-body-sm text-on-surface-muted">
    Binary file — git reports that it changed, but not how.
  </p>
{:else if diff.empty}
  <p class="p-3 text-body-sm text-on-surface-muted">No changes in this file.</p>
{:else}
  <!-- The whole diff scrolls horizontally as one block, so a long line does not
       shift the gutters out from under the rows above it. -->
  <div class="overflow-x-auto">
    <div class="min-w-max text-data">
      {#each diff.lines as line, i (i)}
        <div class="flex {ROW[line.kind]}">
          <!-- `select-none` on the gutters: copying a diff should give the code,
               not the code with line numbers welded to the front of it. -->
          <span
            class="w-10 shrink-0 select-none px-2 text-right text-on-surface-muted tabular-nums"
          >
            {line.oldLine ?? ""}
          </span>
          <span
            class="w-10 shrink-0 select-none px-2 text-right text-on-surface-muted tabular-nums"
          >
            {line.newLine ?? ""}
          </span>
          <span class="w-4 shrink-0 select-none text-center text-on-surface-muted">
            {MARK[line.kind]}
          </span>
          <span class="whitespace-pre pr-3">{line.text}</span>
        </div>
      {/each}
    </div>
  </div>
{/if}
