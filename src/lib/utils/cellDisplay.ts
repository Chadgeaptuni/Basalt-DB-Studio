import type { CellValue, DatetimeDisplay } from "$lib/api/types";

// A timestamp with an offset (trailing Z or ±hh:mm) is convertible; a naive one
// isn't — per spec it stays naive regardless of the display setting.
const HAS_TZ = /(z|[+-]\d\d:?\d\d)$/i;

function renderDateTime(iso: string, mode: DatetimeDisplay): string {
  if (mode === "stored" || !HAS_TZ.test(iso)) return iso;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // sv-SE gives a sortable "YYYY-MM-DD HH:mm:ss"; UTC vs local via timeZone.
  return d.toLocaleString("sv-SE", mode === "utc" ? { timeZone: "UTC" } : {});
}

// Pre-format a CellValue to its display string once per fetch (DESIGN §10), so
// grid cells never re-derive on render. `numeric` drives right-alignment; `isNull`
// tells the grid to render a NULL badge instead of text. `title` carries the full
// value for a tooltip when the cell may be visually truncated.
export interface CellDisplay {
  text: string;
  isNull: boolean;
  numeric: boolean;
  title?: string;
}

export function formatCell(v: CellValue, datetime: DatetimeDisplay = "stored"): CellDisplay {
  switch (v.kind) {
    case "null":
      return { text: "NULL", isNull: true, numeric: false };
    case "bool":
      return { text: v.value ? "true" : "false", isNull: false, numeric: false };
    case "int":
    case "float":
      return { text: String(v.value), isNull: false, numeric: true };
    case "decimal":
      return { text: v.value, isNull: false, numeric: true };
    case "text":
      return { text: v.value, isNull: false, numeric: false };
    case "date":
    case "time":
      // Naive by nature (no offset) — the setting never rewrites these.
      return { text: v.value, isNull: false, numeric: false };
    case "dateTime": {
      const text = renderDateTime(v.value, datetime);
      // Keep the raw stored value in the tooltip when we've reformatted it.
      return { text, isNull: false, numeric: false, title: text === v.value ? undefined : v.value };
    }
    case "json": {
      const s = JSON.stringify(v.value);
      return { text: s, isNull: false, numeric: false, title: s };
    }
    case "bytes": {
      const shown = v.value.preview.length / 2;
      const s = `\\x${v.value.preview}${v.value.len > shown ? "…" : ""} (${v.value.len} bytes)`;
      return { text: s, isNull: false, numeric: false, title: s };
    }
    case "array": {
      const s = `{${v.value.map((e) => formatCell(e, datetime).text).join(", ")}}`;
      return { text: s, isNull: false, numeric: false, title: s };
    }
    case "unknown":
      return {
        text: v.value.display || v.value.typeName,
        isNull: false,
        numeric: false,
        title: v.value.typeName,
      };
  }
}
