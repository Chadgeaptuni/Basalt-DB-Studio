import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
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

/** A CSV whose first record is `header`. */
function csv(header: string[]): void {
  mockIPC((cmd) => (cmd === "csv_header" ? header : undefined));
}

async function chooseFile(): Promise<void> {
  await fireEvent.click(screen.getByRole("button", { name: /Choose CSV/ }));
  await screen.findByText("C:/data/people.csv");
}

afterEach(clearMocks);

describe("ImportWizard", () => {
  // The gate that matters: before the stepper you could reach Import having never
  // looked at the column mapping.
  it("will not advance past the file step without a file", async () => {
    render(ImportWizard, props);

    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByText("No file selected")).toBeInTheDocument();
  });

  // Header names find their columns whatever order the file has them in.
  it("maps header fields to the same-named columns and walks to Import", async () => {
    csv(["Email", "id", "name"]);
    render(ImportWizard, props);

    await chooseFile();
    await fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("3 of 3 fields mapped")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Column for Email" })).toHaveTextContent("email");

    await fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("button", { name: "Import" })).toBeEnabled();
  });

  it("blocks the mapping step when no field matches a column", async () => {
    csv(["a", "b", "c"]);
    render(ImportWizard, props);

    await chooseFile();
    await fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText("0 of 3 fields mapped")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  // Without a header the first record is data, so fields map by position.
  it("maps by position when the first row is not a header", async () => {
    csv(["1", "Ada", "ada@example.com"]);
    render(ImportWizard, props);

    await chooseFile();
    await fireEvent.click(screen.getByLabelText("First row is a header"));
    await fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText("3 of 3 fields mapped")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Column for field 2" })).toHaveTextContent("name");
  });

  it("goes back without losing the file already chosen", async () => {
    csv(["id"]);
    render(ImportWizard, props);

    await chooseFile();
    await fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await fireEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(screen.getByText("C:/data/people.csv")).toBeInTheDocument();
  });
});
