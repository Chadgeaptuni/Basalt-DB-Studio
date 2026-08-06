import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import CellInspector from "./CellInspector.svelte";
import type { CellValue, ColumnInfo } from "$lib/api/types";

const col = (over: Partial<ColumnInfo> = {}): ColumnInfo => ({
  name: "payload",
  typeName: "jsonb",
  nullable: true,
  isPk: false,
  ...over,
});

const show = (value: CellValue, column = col()) =>
  render(CellInspector, { column, value, onclose: () => {} });

describe("CellInspector", () => {
  it("pretty-prints a JSON value", () => {
    show({ kind: "json", value: { a: 1, b: [2, 3] } });
    const body = screen.getByText(/"a": 1/);
    expect(body.textContent).toContain('\n  "b": [');
  });

  // A jsonb column often arrives as text. Reading it as one long line defeats the
  // point of an inspector, so text that parses as JSON is pretty-printed too.
  it("pretty-prints text that is really JSON", () => {
    show({ kind: "text", value: '{"nested":{"deep":true}}' });
    expect(screen.getByText(/"deep": true/)).toBeInTheDocument();
    expect(screen.getByText("JSON")).toBeInTheDocument();
  });

  it("leaves text that only looks like JSON alone", () => {
    show({ kind: "text", value: "{not json at all" });
    expect(screen.getByText("{not json at all")).toBeInTheDocument();
    expect(screen.queryByText("JSON")).not.toBeInTheDocument();
  });

  // Only a preview of a BLOB crosses the wire; the sheet must not imply it holds
  // the whole thing.
  it("says how much of a BLOB it is showing", () => {
    show(
      { kind: "bytes", value: { preview: "deadbeef", len: 4096 } },
      col({ name: "blob", typeName: "bytea" }),
    );
    expect(screen.getByText(/4096 bytes/)).toBeInTheDocument();
    expect(screen.getByText(/first 4 shown/)).toBeInTheDocument();
    expect(screen.getByText(/preview only/)).toBeInTheDocument();
  });

  it("does not claim a truncated preview for a complete BLOB", () => {
    show(
      { kind: "bytes", value: { preview: "deadbeef", len: 4 } },
      col({ name: "blob", typeName: "bytea" }),
    );
    expect(screen.queryByText(/preview only/)).not.toBeInTheDocument();
  });

  // Handing the DOM a multi-megabyte text node locks the window; the body is
  // capped and the cap is stated rather than silently applied.
  it("caps a very large value and says so", () => {
    const huge = "x".repeat(1_000_000);
    show({ kind: "text", value: huge }, col({ name: "notes", typeName: "text" }));

    expect(screen.getByText(/showing the first/)).toBeInTheDocument();
    expect(screen.getByText(/1,000,000 chars/)).toBeInTheDocument();
    const pre = document.querySelector("pre")!;
    expect(pre.textContent!.length).toBe(200_000);
  });

  it("renders NULL as absence rather than the string", () => {
    show({ kind: "null" }, col({ name: "note", typeName: "text" }));
    expect(screen.getByText("NULL", { selector: "pre" })).toBeInTheDocument();
  });
});
