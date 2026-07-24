import { describe, it, expect } from "vitest";
import { keyboard } from "./keyboard";

// jsdom navigator.platform is "" → non-mac → "mod" resolves to Ctrl.
describe("keyboard", () => {
  it("fires a registered shortcut and stops after unregister", () => {
    let fired = 0;
    const off = keyboard.register("mod+b", () => fired++);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "b", ctrlKey: true }));
    expect(fired).toBe(1);

    off();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "b", ctrlKey: true }));
    expect(fired).toBe(1);
  });

  it("ignores non-matching modifier combinations", () => {
    let fired = 0;
    const off = keyboard.register("mod+shift+enter", () => fired++);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true }));
    expect(fired).toBe(0);

    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, shiftKey: true }),
    );
    expect(fired).toBe(1);
    off();
  });

  it("labels combos for display", () => {
    // Non-mac formatting joins with '+'.
    expect(keyboard.label("mod+shift+f")).toBe("Ctrl+Shift+F");
  });
});
