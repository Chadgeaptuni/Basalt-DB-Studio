import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import DataGrid, { type EditController } from "./DataGrid.svelte";
import type { CellValue, ColumnInfo } from "$lib/api/types";

const columns: ColumnInfo[] = [
  { name: "id", typeName: "integer", nullable: false, isPk: true },
  { name: "name", typeName: "text", nullable: false, isPk: false },
];

const rows: CellValue[][] = [
  [
    { kind: "int", value: 1 },
    { kind: "text", value: "Ada" },
  ],
  [
    { kind: "int", value: 2 },
    { kind: "text", value: "Grace" },
  ],
];

function editable(): EditController {
  return {
    rowState: () => "normal",
    isDirty: () => false,
    commit: vi.fn(),
    setNull: vi.fn(),
    toggleDelete: vi.fn(),
  };
}

describe("DataGrid", () => {
  it("supports keyboard selection and copy for read-only query results", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(DataGrid, { columns, rows, label: "Query results" });
    const grid = screen.getByRole("grid", { name: "Query results" });
    const viewport = grid.querySelector<HTMLElement>(".overflow-auto")!;
    Object.defineProperty(viewport, "clientHeight", { configurable: true, value: 64 });

    await fireEvent.focus(grid);
    expect(screen.getByText("1").closest("[role=gridcell]")).toHaveAttribute("aria-selected", "true");

    await fireEvent.keyDown(grid, { key: "ArrowRight" });
    expect(screen.getByText("Ada").closest("[role=gridcell]")).toHaveAttribute("aria-selected", "true");

    await fireEvent.keyDown(grid, { key: "ArrowDown" });
    expect(screen.getByText("Grace").closest("[role=gridcell]")).toHaveAttribute("aria-selected", "true");
    expect(viewport.scrollTop).toBe(28);

    await fireEvent.keyDown(grid, { key: "c", metaKey: true });
    expect(writeText).toHaveBeenCalledWith("Grace");

    expect(await fireEvent.keyDown(grid, { key: "Tab" })).toBe(true);
  });

  // Regression: the draft is seeded from the *display* string, which for several
  // kinds is not the stored form (JSON/array serialised, NULL shown as empty,
  // datetimes re-rendered). Committing it unchanged staged a phantom edit.
  it("stages nothing when an edit session leaves the text unchanged", async () => {
    const edit = editable();
    const mixed: CellValue[][] = [
      [
        { kind: "text", value: "Ada" },
        { kind: "int", value: 42 },
        { kind: "json", value: { a: 1 } },
        { kind: "array", value: [{ kind: "int", value: 1 }] },
        { kind: "null" },
        { kind: "dateTime", value: "2026-01-02T03:04:05Z" },
      ],
    ];
    const mixedColumns: ColumnInfo[] = mixed[0].map((_, i) => ({
      name: `c${i}`,
      typeName: "text",
      nullable: true,
      isPk: false,
    }));

    render(DataGrid, { columns: mixedColumns, rows: mixed, edit });
    const cells = screen.getAllByRole("gridcell");

    for (const cell of cells) {
      await fireEvent.dblClick(cell);
      const input = screen.getByRole("textbox");
      await fireEvent.blur(input);
    }

    expect(edit.commit).not.toHaveBeenCalled();
  });

  it("stages a single edit when the text actually changes", async () => {
    const edit = editable();
    render(DataGrid, { columns, rows, edit });

    await fireEvent.dblClick(screen.getByText("Ada").closest("[role=gridcell]")!);
    const input = screen.getByRole("textbox");
    await fireEvent.input(input, { target: { value: "Ada Lovelace" } });
    await fireEvent.blur(input);

    expect(edit.commit).toHaveBeenCalledTimes(1);
    expect(edit.commit).toHaveBeenCalledWith(0, 1, "Ada Lovelace");
  });

  it("exposes table structure to assistive technology", () => {
    render(DataGrid, { columns, rows });
    const grid = screen.getByRole("grid", { name: "Data grid" });

    expect(grid).toHaveAttribute("aria-rowcount", "3");
    expect(grid).toHaveAttribute("aria-colcount", "2");
    expect(screen.getAllByRole("columnheader")).toHaveLength(2);
    expect(screen.getAllByRole("row")).toHaveLength(3);
  });
});
