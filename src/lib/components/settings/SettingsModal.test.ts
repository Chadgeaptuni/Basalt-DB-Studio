import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import SettingsModal from "./SettingsModal.svelte";

describe("SettingsModal", () => {
  it("opens the destination the caller asked for", async () => {
    render(SettingsModal, { initialTab: "appearance", onclose: () => {} });

    expect(await screen.findByRole("heading", { name: "Appearance" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Appearance" })).toHaveAttribute("aria-current", "true");
  });

  it("switches destinations without leaving the dialog", async () => {
    render(SettingsModal, { onclose: () => {} });

    expect(await screen.findByRole("heading", { name: "General" })).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: "Shortcuts" }));

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
