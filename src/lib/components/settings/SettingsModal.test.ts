import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import SettingsModal from "./SettingsModal.svelte";

describe("SettingsModal", () => {
  it("opens the destination the caller asked for", async () => {
    render(SettingsModal, { initialTab: "appearance", onclose: () => {} });

    expect(await screen.findByRole("heading", { name: "Appearance" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Appearance" })).toHaveAttribute("aria-current", "true");
  });

  it("gives the general preferences their own destination", async () => {
    render(SettingsModal, { onclose: () => {} });

    // Default landing, and the settings live here rather than under Appearance.
    expect(await screen.findByRole("heading", { name: "General" })).toBeInTheDocument();
    expect(screen.getByText("Date Time Display")).toBeInTheDocument();
    expect(screen.getByText("Default Row Limit")).toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: "Appearance" }));

    expect(screen.getByRole("heading", { name: "Appearance" })).toBeInTheDocument();
    expect(screen.queryByText("Date Time Display")).not.toBeInTheDocument();
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
