import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CellValue, RunResult, StatementResult } from "$lib/api/types";
import { editorTabs } from "$lib/stores/tabs.svelte";
import { zoom } from "$lib/stores/zoom.svelte";
import StatusBar from "./StatusBar.svelte";

const row = (n: number): CellValue[] => [{ kind: "int", value: n }];

const statement = (over: Partial<StatementResult> = {}): StatementResult => ({
  columns: [{ name: "id", typeName: "int4", nullable: false, isPk: true }],
  rows: [],
  rowsAffected: 0,
  truncated: false,
  durationMs: 0,
  ...over,
});

function seedRun(result: RunResult): void {
  const id = editorTabs.open("select 1");
  const tab = editorTabs.find(id);
  if (!tab) throw new Error("tab not opened");
  tab.result = result;
}

beforeEach(() => {
  mockIPC((cmd) => (cmd === "list_connections" ? [] : undefined));
  zoom.reset();
});

afterEach(() => {
  clearMocks();
  zoom.reset();
  for (const t of [...editorTabs.list]) editorTabs.close(t.id);
});

describe("StatusBar zoom stepper", () => {
  it("steps the level in both directions and resets from the reading", async () => {
    render(StatusBar);
    expect(screen.getByText("100%")).toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: /Zoom in/ }));
    expect(screen.getByText("110%")).toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: /Zoom out/ }));
    await fireEvent.click(screen.getByRole("button", { name: /Zoom out/ }));
    expect(screen.getByText("90%")).toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: "90%" }));
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  // A button at the end of the range would clamp back to the level it is already
  // at, so a click that does nothing must not look like one that failed.
  it("disables the step that would do nothing", async () => {
    render(StatusBar);
    const zoomIn = screen.getByRole("button", { name: /Zoom in/ });
    const zoomOut = screen.getByRole("button", { name: /Zoom out/ });
    expect(zoomIn).toBeEnabled();
    expect(zoomOut).toBeEnabled();

    for (let i = 0; i < 12; i++) await fireEvent.click(zoomIn);
    expect(screen.getByText("200%")).toBeInTheDocument();
    expect(zoomIn).toBeDisabled();
    expect(zoomOut).toBeEnabled();

    for (let i = 0; i < 20; i++) await fireEvent.click(zoomOut);
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(zoomOut).toBeDisabled();
    expect(zoomIn).toBeEnabled();
  });
});

describe("StatusBar session zone", () => {
  // Idle means no scaffolding: no empty divider, no zeroed counters standing in
  // for a run that has not happened.
  it("shows nothing about a statement before one runs", () => {
    render(StatusBar);
    expect(screen.queryByText("rows")).not.toBeInTheDocument();
    expect(screen.queryByText("ms")).not.toBeInTheDocument();
  });

  it("reports rows and duration for a select", async () => {
    seedRun({
      statements: [statement({ rows: [row(1), row(2), row(3)], durationMs: 42 })],
      txStatus: "idle",
    });
    render(StatusBar);

    expect(await screen.findByText("3")).toBeInTheDocument();
    expect(screen.getByText(/rows/)).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.queryByText("limit")).not.toBeInTheDocument();
  });

  // The count alone reads as the whole answer; the badge is what says it is not.
  it("badges a truncated result", async () => {
    seedRun({
      statements: [statement({ rows: [row(1)], truncated: true, durationMs: 7 })],
      txStatus: "idle",
    });
    render(StatusBar);

    expect(await screen.findByText("limit")).toBeInTheDocument();
  });

  it("counts affected rows for a statement with no result set", async () => {
    seedRun({
      statements: [statement({ columns: [], rowsAffected: 5, durationMs: 11 })],
      txStatus: "inTx",
    });
    render(StatusBar);

    expect(await screen.findByText(/affected/)).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("TX")).toBeInTheDocument();
  });

  // A failed statement has a duration and a zero row count, and showing them puts
  // a plausible-looking result in the bar for a query that produced none — the
  // error itself belongs in the results pane, which renders it in full.
  it("stays quiet about a statement that failed", () => {
    seedRun({
      statements: [
        statement({ durationMs: 3, error: { kind: "queryError", message: "syntax error" } }),
      ],
      txStatus: "error",
    });
    render(StatusBar);

    expect(screen.queryByText(/rows/)).not.toBeInTheDocument();
    expect(screen.getByText("TX err")).toBeInTheDocument();
  });
});
