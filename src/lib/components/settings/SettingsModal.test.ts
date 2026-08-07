import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { settings } from "$lib/stores/settings.svelte";
import SettingsModal from "./SettingsModal.svelte";

beforeEach(() => {
  // Every setter persists immediately; without this the store's save reaches a
  // real `invoke` and each test raises a toast about it.
  mockIPC(() => undefined);
  settings.setDatetimeDisplay("stored");
  settings.setDefaultRowLimit(500);
});

afterEach(() => {
  clearMocks();
  settings.setDatetimeDisplay("stored");
  settings.setDefaultRowLimit(500);
});

describe("SettingsModal", () => {
  it("opens the destination the caller asked for", async () => {
    render(SettingsModal, { initialTab: "appearance", onclose: () => {} });

    expect(await screen.findByRole("heading", { name: "Appearance" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Appearance" })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("gives the general preferences their own destination", async () => {
    render(SettingsModal, { onclose: () => {} });

    // Default landing, and the settings live here rather than under Appearance.
    expect(await screen.findByRole("heading", { name: "General" })).toBeInTheDocument();
    expect(screen.getByText("Date and time display")).toBeInTheDocument();
    expect(screen.getByText("Default row limit")).toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: "Appearance" }));

    expect(screen.getByRole("heading", { name: "Appearance" })).toBeInTheDocument();
    expect(screen.queryByText("Date and time display")).not.toBeInTheDocument();
  });

  it("switches destinations without leaving the dialog", async () => {
    render(SettingsModal, { onclose: () => {} });

    await fireEvent.click(await screen.findByRole("button", { name: "Shortcuts" }));

    expect(screen.getByRole("heading", { name: "Shortcuts" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "General" })).not.toBeInTheDocument();
  });

  it("keeps the close action available", async () => {
    const onclose = vi.fn();
    render(SettingsModal, { onclose });

    await fireEvent.click(await screen.findByRole("button", { name: "Close" }));

    expect(onclose).toHaveBeenCalledOnce();
  });
});

describe("SettingsModal · General", () => {
  const openGeneral = () =>
    render(SettingsModal, { props: { initialTab: "general", onclose: vi.fn() } });

  // The label lives in a text column beside the control, not wrapped around it,
  // so nothing associates the two implicitly. `SettingRow` hands its label down
  // to the control; if that ever stops, every control here goes anonymous.
  it("names each control from the row it sits in", () => {
    openGeneral();

    expect(screen.getByRole("button", { name: "Date and time display" })).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Default row limit" })).toBeInTheDocument();
  });

  it("shows the stored value as a label, not as its wire value", () => {
    openGeneral();
    expect(screen.getByRole("button", { name: "Date and time display" })).toHaveTextContent(
      "As stored (raw)",
    );
  });

  it("persists a new datetime mode when a row is picked", async () => {
    openGeneral();

    await fireEvent.pointerDown(screen.getByRole("button", { name: "Date and time display" }), {
      button: 0,
      pointerType: "mouse",
    });
    await fireEvent.pointerUp(await screen.findByRole("option", { name: "UTC" }), {
      pointerType: "mouse",
    });

    await waitFor(() => expect(settings.datetimeDisplay).toBe("utc"));
  });

  it("takes a new row limit from the field", async () => {
    openGeneral();

    const field = screen.getByRole("spinbutton", { name: "Default row limit" });
    await fireEvent.input(field, { target: { value: "2500" } });

    expect(settings.defaultRowLimit).toBe(2500);
  });

  // A limit of zero or a half-typed minus sign would fetch nothing; the field
  // keeps the last good value rather than committing a number that can't run.
  it("ignores a row limit that is not a positive number", async () => {
    openGeneral();

    const field = screen.getByRole("spinbutton", { name: "Default row limit" });
    await fireEvent.input(field, { target: { value: "0" } });
    expect(settings.defaultRowLimit).toBe(500);

    await fireEvent.input(field, { target: { value: "" } });
    expect(settings.defaultRowLimit).toBe(500);
  });
});
