import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import type { SelectOption } from "./Select.svelte";
import SelectTestHarness from "./Select.test-harness.svelte";

// Mirrors the connection form's environment list, empty-string option and all.
const OPTIONS: SelectOption[] = [
  { value: "", label: "Untagged" },
  { value: "local", label: "Local" },
  { value: "prod", label: "Production" },
];

// bits-ui's select trigger is a button carrying `aria-haspopup="listbox"`, not a
// combobox — a combobox implies a text input the user can type into.
const trigger = () => screen.getByRole("button", { name: "Environment" });

// bits-ui opens on `pointerdown` and commits on `pointerup`, so a power user can
// press on the trigger and release on the row in one gesture. `click` alone never
// reaches either handler.
const open = () => fireEvent.pointerDown(trigger(), { button: 0, pointerType: "mouse" });
const pick = (name: string) =>
  fireEvent.pointerUp(screen.getByRole("option", { name }), { pointerType: "mouse" });

describe("Select", () => {
  // The trigger's own text is the selected value, so without the label a screen
  // reader announces "Production, combobox" and never says what it sets.
  it("names the trigger from the label, not from the value it happens to show", () => {
    render(SelectTestHarness, { props: { options: OPTIONS, initial: "prod" } });

    expect(trigger()).toHaveAccessibleName("Environment");
    expect(trigger()).toHaveTextContent("Production");
  });

  // An option may legitimately carry the empty string — a connection with no
  // environment tag is "Untagged", a real choice rather than an absent one, and
  // resolving it through bits-ui's own value slot would show the placeholder.
  it("treats an empty-string option as a choice", () => {
    render(SelectTestHarness, { props: { options: OPTIONS, initial: "" } });
    expect(trigger()).toHaveTextContent("Untagged");
  });

  it("falls back to the placeholder when the value matches no option", () => {
    render(SelectTestHarness, { props: { options: OPTIONS, initial: "staging" } });
    expect(trigger()).toHaveTextContent("Select…");
  });

  it("opens a listbox and commits the row that is picked", async () => {
    const onchange = vi.fn();
    render(SelectTestHarness, { props: { options: OPTIONS, initial: "local", onchange } });

    await open();
    const listbox = await screen.findByRole("listbox");
    expect(
      [...listbox.querySelectorAll('[role="option"]')].map((o) => o.textContent?.trim()),
    ).toEqual(["Untagged", "Local", "Production"]);

    await pick("Production");

    expect(onchange).toHaveBeenCalledWith("prod");
    await waitFor(() => expect(screen.getByTestId("bound")).toHaveTextContent("prod"));
    expect(trigger()).toHaveTextContent("Production");
  });

  // Every dropdown in the app has to be the same object; a listbox that draws its
  // own container is how they stop being one.
  it("draws its listbox on the shared popup surface", async () => {
    render(SelectTestHarness, { props: { options: OPTIONS } });

    await open();
    const listbox = await screen.findByRole("listbox");
    const surface = listbox.closest("[class*='shadow-e2']");

    expect(surface).not.toBeNull();
    expect(surface).toHaveClass("bg-surface-container-high", "border-outline-variant", "rounded-md");
  });
});
