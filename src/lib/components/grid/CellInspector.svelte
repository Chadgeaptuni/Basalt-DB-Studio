<script lang="ts">
  import Copy from "@lucide/svelte/icons/copy";
  import SideSheet from "$lib/components/ui/SideSheet.svelte";
  import IconButton from "$lib/components/ui/IconButton.svelte";
  import Badge from "$lib/components/ui/Badge.svelte";
  import { copyCellsTsv } from "$lib/utils/copy";
  import type { CellValue, ColumnInfo } from "$lib/api/types";

  // Reads one cell in full, which the grid physically cannot: a row is 28px and a
  // column caps at 400px, so JSON, long text and BLOBs are always truncated there.
  interface Props {
    column: ColumnInfo;
    value: CellValue;
    onclose: () => void;
  }
  let { column, value, onclose }: Props = $props();

  // A cell is rendered at most once per selection, so the cost is bounded by one
  // value — but that value can be megabytes, so the body is capped and says so
  // rather than handing the DOM a 10MB text node.
  const MAX_CHARS = 200_000;

  interface Rendered {
    body: string;
    /** Set when the value is a JSON document we pretty-printed. */
    pretty: boolean;
    size?: string;
  }

  const rendered = $derived.by<Rendered>(() => {
    switch (value.kind) {
      case "null":
        return { body: "NULL", pretty: false };
      case "json":
        return { body: JSON.stringify(value.value, null, 2), pretty: true };
      case "bytes": {
        // Only a preview crosses the wire, so say what is shown vs. what exists —
        // otherwise the sheet looks like the whole blob.
        const shown = value.value.preview.length / 2;
        const complete = shown >= value.value.len;
        return {
          body: `\\x${value.value.preview}${complete ? "" : "\n\n… preview only"}`,
          pretty: false,
          size: `${value.value.len} bytes${complete ? "" : ` · first ${shown} shown`}`,
        };
      }
      case "array":
        return { body: JSON.stringify(value.value, null, 2), pretty: true };
      case "unknown":
        return { body: value.value.display || "", pretty: false };
      case "bool":
        return { body: value.value ? "true" : "false", pretty: false };
      case "int":
      case "float":
        return { body: String(value.value), pretty: false };
      default: {
        // Text may itself be JSON — a very common column shape — so pretty-print
        // when it parses and fall back to the raw string when it doesn't.
        const raw = value.value;
        if (raw.length < MAX_CHARS && /^\s*[[{]/.test(raw)) {
          try {
            return { body: JSON.stringify(JSON.parse(raw), null, 2), pretty: true };
          } catch {
            /* not JSON after all — fall through to raw */
          }
        }
        return { body: raw, pretty: false };
      }
    }
  });

  const truncated = $derived(rendered.body.length > MAX_CHARS);
  const body = $derived(truncated ? rendered.body.slice(0, MAX_CHARS) : rendered.body);
  const chars = $derived(rendered.body.length);
</script>

<SideSheet title={column.name} {onclose}>
  <div class="flex flex-col gap-3 p-3">
    <div class="flex flex-wrap items-center gap-2">
      <Badge>{column.typeName}</Badge>
      {#if column.isPk}<Badge variant="primary">PK</Badge>{/if}
      {#if value.kind === "null"}<Badge variant="warn">NULL</Badge>{/if}
      {#if rendered.pretty}<Badge>JSON</Badge>{/if}
      <div class="flex-1"></div>
      <IconButton
        icon={Copy}
        title="Copy value"
        size="sm"
        onclick={() => void copyCellsTsv([[value]])}
      />
    </div>

    <div class="flex items-center gap-2 text-label-sm text-on-surface-muted tabular-nums">
      <span>{rendered.size ?? `${chars.toLocaleString()} chars`}</span>
      {#if truncated}
        <span class="text-warn">· showing the first {MAX_CHARS.toLocaleString()}</span>
      {/if}
    </div>

    <pre
      class="rounded-sm bg-surface-container-low p-3 text-data break-words whitespace-pre-wrap
        {value.kind === 'null' ? 'text-grid-null italic' : 'text-on-surface-variant'}">{body}</pre>
  </div>
</SideSheet>
