import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import ModalTestHarness from "./Modal.test-harness.svelte";

describe("Modal", () => {
  it("labels the dialog, moves focus inside, and restores focus after Escape", async () => {
    const view = render(ModalTestHarness);
    const trigger = screen.getByRole("button", { name: "Open modal" });

    trigger.focus();
    await fireEvent.click(trigger);

    const dialog = await screen.findByRole("dialog", { name: "Connection details" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveClass("fixed");
    await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));

    await fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    view.unmount();
  });
});
