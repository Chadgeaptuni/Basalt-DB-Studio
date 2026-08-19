import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { zoom } from "./zoom.svelte";

const root = document.documentElement;
const level = () => root.style.getPropertyValue("--ui-zoom");

describe("zoom store (DOM application)", () => {
  beforeEach(() => {
    root.removeAttribute("style");
    zoom.reset();
  });

  afterEach(() => zoom.reset());

  // The regression this file exists for: the level used to be written straight
  // onto #app, which left every portalled overlay — dialogs, menus, tooltips, the
  // select listbox, all mounted on <body> beside #app — rendering at 100% while
  // the rest of the app scaled. One custom property on <html> is inherited by
  // both roots, so #app and the overlays cannot drift apart.
  it("publishes the level on <html>, not on #app", () => {
    const app = document.createElement("div");
    app.id = "app";
    document.body.append(app);

    zoom.in();

    expect(level()).toBe("1.1");
    expect(app.style.zoom).toBe("");

    app.remove();
  });

  it("steps by a tenth and clamps to the stepper's own range", () => {
    for (let i = 0; i < 12; i++) zoom.in();
    expect(level()).toBe("2");
    expect(zoom.canIn).toBe(false);

    for (let i = 0; i < 20; i++) zoom.out();
    expect(level()).toBe("0.5");
    expect(zoom.canOut).toBe(false);

    zoom.reset();
    expect(level()).toBe("1");
  });

  it("re-publishes the persisted level on apply", () => {
    zoom.in();
    root.removeAttribute("style");
    expect(level()).toBe("");

    zoom.apply();
    expect(level()).toBe("1.1");
  });
});
