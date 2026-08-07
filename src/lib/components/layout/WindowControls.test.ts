import { fireEvent, render, screen } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The api module reaches Tauri at import time, so it is mocked rather than the
// window object faked. `available` is what the component gates on.
const api = vi.hoisted(() => ({
  available: true,
  minimize: vi.fn(),
  toggleMaximize: vi.fn(),
  close: vi.fn(),
  isMaximized: vi.fn().mockResolvedValue(false),
  onMaximizeChange: vi.fn((run: (v: boolean) => void) => {
    run(false);
    return () => {};
  }),
}));
vi.mock("$lib/api/window", () => ({ windowApi: api }));

const WindowControls = (await import("./WindowControls.svelte")).default;

describe("WindowControls", () => {
  beforeEach(() => {
    api.available = true;
    api.minimize.mockClear();
    api.toggleMaximize.mockClear();
    api.close.mockClear();
  });

  it("drives the window from each button", async () => {
    render(WindowControls);

    await fireEvent.click(screen.getByRole("button", { name: "Minimize" }));
    expect(api.minimize).toHaveBeenCalledOnce();

    await fireEvent.click(screen.getByRole("button", { name: "Maximize" }));
    expect(api.toggleMaximize).toHaveBeenCalledOnce();

    await fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(api.close).toHaveBeenCalledOnce();
  });

  // The glyph and name are the only signal that the button restores rather than
  // maximizes, and the window can reach that state without this button at all
  // (drag to the top edge, double-click the bar, Win+Up).
  it("follows the window into and out of maximized", async () => {
    let emit: (v: boolean) => void = () => {};
    api.onMaximizeChange.mockImplementationOnce((run: (v: boolean) => void) => {
      emit = run;
      run(false);
      return () => {};
    });
    render(WindowControls);

    expect(screen.getByRole("button", { name: "Maximize" })).toBeInTheDocument();

    emit(true);
    expect(await screen.findByRole("button", { name: "Restore" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Maximize" })).not.toBeInTheDocument();
  });

  // Outside Tauri — a browser, or this test suite — there is no window to drive,
  // so buttons that could only throw are not drawn.
  it("renders nothing when there is no window to control", () => {
    api.available = false;
    render(WindowControls);
    expect(screen.queryAllByRole("button")).toEqual([]);
  });
});
