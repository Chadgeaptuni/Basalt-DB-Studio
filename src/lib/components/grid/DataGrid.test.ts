import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import DataGrid from "./DataGrid.svelte";
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

  it("exposes table structure to assistive technology", () => {
    render(DataGrid, { columns, rows });
    const grid = screen.getByRole("grid", { name: "Data grid" });

    expect(grid).toHaveAttribute("aria-rowcount", "3");
    expect(grid).toHaveAttribute("aria-colcount", "2");
    expect(screen.getAllByRole("columnheader")).toHaveLength(2);
    expect(screen.getAllByRole("row")).toHaveLength(3);
  });
});
