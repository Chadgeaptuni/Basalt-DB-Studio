import { describe, it, expect } from "vitest";
import { keyboard } from "./keyboard";

// jsdom navigator.platform is "" → non-mac, so combos join with "+". The
// modifier glyphs themselves are platform-independent (see MODIFIER_GLYPHS).
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
    expect(keyboard.label("mod+shift+f")).toBe("⌘+⇧+F");
  });

  // Kbd renders one element per key, so the split form is the primitive and the
  // flat label is derived from it — the two can't drift apart.
  it("splits a combo into one label per key", () => {
    expect(keyboard.keys("mod+shift+f")).toEqual(["⌘", "⇧", "F"]);
    expect(keyboard.keys("mod+enter")).toEqual(["⌘", "↵"]);
    expect(keyboard.keys("arrowleft")).toEqual(["←"]);
    expect(keyboard.keys("mod+shift+f").join("+")).toBe(keyboard.label("mod+shift+f"));
  });

  // The shortcut catalogue renders every key through label(); named keys used to
  // Title-Case into "Pageup", which is why Settings hand-wrote its own key text.
  it("labels named keys with their conventional forms", () => {
    expect(keyboard.label("ctrl+pageup")).toBe("⌘+PgUp");
    expect(keyboard.label("ctrl+pagedown")).toBe("⌘+PgDn");
    expect(keyboard.label("arrowleft")).toBe("←");
    expect(keyboard.label("delete")).toBe("Del");
    expect(keyboard.label("escape")).toBe("Esc");
    expect(keyboard.label("mod+enter")).toBe("⌘+↵");
  });

  // Off macOS `mod` and a literal `ctrl` binding are the same physical key, so
  // they must print the same glyph — otherwise the shortcut list shows one key
  // under two symbols and reads as two different chords.
  it("gives one physical key one glyph", () => {
    expect(keyboard.keys("ctrl+pageup")[0]).toBe(keyboard.keys("mod+b")[0]);
  });
});
