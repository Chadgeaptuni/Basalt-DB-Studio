import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import ImportWizard from "./ImportWizard.svelte";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn().mockResolvedValue("C:/data/people.csv"),
}));

const props = {
  namespace: "public",
  table: "people",
  columns: ["id", "name", "email"],
  onclose: () => {},
};

describe("ImportWizard", () => {
  // The gate that matters: before the stepper you could reach Import having never
  // looked at the column mapping.
  it("will not advance past the file step without a file", async () => {
    render(ImportWizard, props);

    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByText("No file selected")).toBeInTheDocument();
  });

  it("walks file → columns → options and imports", async () => {
    render(ImportWizard, props);

    await fireEvent.click(screen.getByRole("button", { name: /Choose CSV/ }));
    expect(await screen.findByText("C:/data/people.csv")).toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("3 of 3 selected")).toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Conflict mode")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import" })).toBeEnabled();
  });

  it("blocks the columns step when every column is deselected", async () => {
    render(ImportWizard, props);

    await fireEvent.click(screen.getByRole("button", { name: /Choose CSV/ }));
    await screen.findByText("C:/data/people.csv");
    await fireEvent.click(screen.getByRole("button", { name: "Next" }));

    for (const col of props.columns) {
      await fireEvent.click(screen.getByLabelText(col));
    }

    expect(screen.getByText("0 of 3 selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("goes back without losing the file already chosen", async () => {
    render(ImportWizard, props);

    await fireEvent.click(screen.getByRole("button", { name: /Choose CSV/ }));
    await screen.findByText("C:/data/people.csv");
    await fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await fireEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(screen.getByText("C:/data/people.csv")).toBeInTheDocument();
  });
});
