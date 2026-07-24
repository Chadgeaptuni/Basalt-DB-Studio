import type { CellValue } from "$lib/api/types";

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

export function formatCell(v: CellValue): CellDisplay {
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
    case "dateTime":
      return { text: v.value, isNull: false, numeric: false };
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
      const s = `{${v.value.map((e) => formatCell(e).text).join(", ")}}`;
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
