import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import NumberField from "./NumberField.svelte";

const field = () => screen.getByRole("spinbutton", { name: "Default row limit" });
const up = () => screen.getByRole("button", { name: "Increase default row limit" });
const down = () => screen.getByRole("button", { name: "Decrease default row limit" });

function mount(props: Record<string, unknown> = {}) {
  const onchange = vi.fn();
  render(NumberField, {
    props: { value: 500, label: "Default row limit", min: 1, step: 100, onchange, ...props },
  });
  return onchange;
}

describe("NumberField", () => {
  it("steps by the step, not by one", async () => {
    const onchange = mount();

    await fireEvent.click(up());
    expect(onchange).toHaveBeenCalledWith(600);

    await fireEvent.click(down());
    expect(onchange).toHaveBeenLastCalledWith(400);
  });

  it("commits a typed value", async () => {
    const onchange = mount();
    await fireEvent.input(field(), { target: { value: "2500" } });
    expect(onchange).toHaveBeenCalledWith(2500);
  });

  // Below the minimum, or mid-edit, there is nothing to save — committing would
  // put a number that cannot run into the setting.
  it("holds back a value outside the range", async () => {
    const onchange = mount();

    await fireEvent.input(field(), { target: { value: "0" } });
    await fireEvent.input(field(), { target: { value: "" } });

    expect(onchange).not.toHaveBeenCalled();
  });

  // Without this the field goes on showing a rejected number while the setting
  // holds a different one, and nothing on screen says which is in force.
  it("puts the live value back when a rejected edit loses focus", async () => {
    mount();
    const input = field() as HTMLInputElement;

    await fireEvent.input(input, { target: { value: "0" } });
    expect(input.value).toBe("0");

    await fireEvent.blur(input);
    expect(input.value).toBe("500");
  });

  it("stops stepping at the ends of the range", () => {
    mount({ value: 1 });
    expect(down()).toBeDisabled();
    expect(up()).toBeEnabled();
  });

  it("caps at a maximum when one is set", () => {
    mount({ value: 1000, max: 1000 });
    expect(up()).toBeDisabled();
    expect(down()).toBeEnabled();
  });

  // The input already steps on ArrowUp/ArrowDown, so tabbing through the buttons
  // would be two extra stops onto an action the focused field performs.
  it("keeps the steppers out of the tab order", () => {
    mount();
    expect(up()).toHaveAttribute("tabindex", "-1");
    expect(down()).toHaveAttribute("tabindex", "-1");
  });

  // The engine's own arrows are unthemeable, which is the whole reason this
  // component exists — leaving them on would show two sets side by side.
  it("suppresses the engine's own spin buttons", () => {
    mount();
    expect(field()).toHaveClass("no-native-spinner");
  });
});
