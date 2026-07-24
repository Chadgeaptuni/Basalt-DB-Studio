import { describe, expect, it } from "vitest";
import { formatCell } from "./cellDisplay";

describe("formatCell", () => {
  it("marks NULL for the grid badge", () => {
    expect(formatCell({ kind: "null" })).toEqual({ text: "NULL", isNull: true, numeric: false });
  });

  it("right-aligns numbers and keeps decimals as their exact string", () => {
    expect(formatCell({ kind: "int", value: 42 }).numeric).toBe(true);
    expect(formatCell({ kind: "decimal", value: "12345.6789" })).toMatchObject({
      text: "12345.6789",
      numeric: true,
    });
  });

  it("does not right-align text/bool", () => {
    expect(formatCell({ kind: "text", value: "hi" }).numeric).toBe(false);
    expect(formatCell({ kind: "bool", value: true })).toMatchObject({ text: "true", numeric: false });
  });

  it("stringifies json and flags truncated bytes with an ellipsis", () => {
    expect(formatCell({ kind: "json", value: { a: 1 } }).text).toBe('{"a":1}');
    // preview is 2 bytes of hex; len 5 > 1 shown byte → ellipsis.
    expect(formatCell({ kind: "bytes", value: { len: 5, preview: "de" } }).text).toBe(
      "\\xde… (5 bytes)",
    );
    // len equals shown bytes → no ellipsis.
    expect(formatCell({ kind: "bytes", value: { len: 1, preview: "de" } }).text).toBe(
      "\\xde (1 bytes)",
    );
  });

  it("renders arrays with nested formatting", () => {
    expect(
      formatCell({ kind: "array", value: [{ kind: "int", value: 1 }, { kind: "null" }] }).text,
    ).toBe("{1, NULL}");
  });

  it("falls back to display then type name for unknown", () => {
    expect(formatCell({ kind: "unknown", value: { typeName: "geometry", display: "" } }).text).toBe(
      "geometry",
    );
  });

  it("leaves datetimes untouched under the default (stored) mode", () => {
    const v = { kind: "dateTime", value: "2024-01-02T05:00:00+02:00" } as const;
    expect(formatCell(v)).toEqual({ text: "2024-01-02T05:00:00+02:00", isNull: false, numeric: false, title: undefined });
  });

  it("converts an offset datetime to UTC and keeps the raw value as tooltip", () => {
    const v = { kind: "dateTime", value: "2024-01-02T05:00:00+02:00" } as const;
    // 05:00+02:00 == 03:00Z.
    expect(formatCell(v, "utc")).toMatchObject({
      text: "2024-01-02 03:00:00",
      title: "2024-01-02T05:00:00+02:00",
    });
  });

  it("never rewrites a naive datetime, even in UTC mode", () => {
    const v = { kind: "dateTime", value: "2024-01-02 05:00:00" } as const;
    expect(formatCell(v, "utc").text).toBe("2024-01-02 05:00:00");
  });

  it("leaves date and time (no offset) as-is regardless of mode", () => {
    expect(formatCell({ kind: "date", value: "2024-01-02" }, "utc").text).toBe("2024-01-02");
    expect(formatCell({ kind: "time", value: "05:00:00" }, "local").text).toBe("05:00:00");
  });
});
