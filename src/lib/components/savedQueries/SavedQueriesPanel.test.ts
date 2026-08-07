import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import SavedQueriesPanel from "./SavedQueriesPanel.svelte";

const keyboardMock = vi.hoisted(() => ({ label: vi.fn(() => "⌘S") }));
vi.mock("$lib/utils/keyboard", () => ({ keyboard: keyboardMock }));

afterEach(() => {
  clearMocks();
  keyboardMock.label.mockClear();
});

describe("SavedQueriesPanel", () => {
  it("shows the platform-correct save shortcut in its empty state", async () => {
    mockIPC((cmd) => (cmd === "list_saved_queries" ? [] : undefined));

    render(SavedQueriesPanel);

    // The shortcut is rendered through `keyboard.label`, never written out, so
    // the hint picks up the platform's separator without this copy knowing.
    expect(
      await screen.findByText("Write one in the editor and press ⌘S to save it here."),
    ).toBeInTheDocument();
    expect(keyboardMock.label).toHaveBeenCalledWith("mod+s");
  });

  it("lets the user retry after a load failure", async () => {
    let attempts = 0;
    mockIPC((cmd) => {
      if (cmd !== "list_saved_queries") return undefined;
      attempts += 1;
      if (attempts === 1) throw { kind: "configIo", message: "Saved query directory is unavailable" };
      return [];
    });
    render(SavedQueriesPanel);
    expect(await screen.findByText("Saved query directory is unavailable")).toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText(/No saved queries/)).toBeInTheDocument();
    expect(attempts).toBe(2);
  });
});
