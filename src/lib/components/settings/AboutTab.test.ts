import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppInfo } from "$lib/api/types";
import { toasts } from "$lib/stores/toasts.svelte";
import AboutTab from "./AboutTab.svelte";

const INFO: AppInfo = {
  name: "Basalt DB Studio",
  version: "0.1.0",
  identifier: "com.basalt.db-studio",
  tauriVersion: "2.11.5",
  webviewVersion: "141.0.3537.57",
  osName: "Windows 11",
  osVersion: "10.0.26200",
  os: "windows",
  arch: "x86_64",
  family: "windows",
  debug: false,
};

const write = vi.fn<(text: string) => Promise<void>>();

beforeEach(() => {
  write.mockReset();
  write.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText: write }, configurable: true });
});

afterEach(() => {
  clearMocks();
  for (const t of [...toasts.items]) toasts.dismiss(t.id);
});

function mount(info: Partial<AppInfo> = {}): void {
  mockIPC((cmd) => (cmd === "app_info" ? { ...INFO, ...info } : undefined));
  render(AboutTab);
}

describe("AboutTab", () => {
  it("reports what is running and what it is running on", async () => {
    mount();

    expect(await screen.findByRole("heading", { name: "Basalt DB Studio" })).toBeInTheDocument();
    const shown = [
      "0.1.0",
      "com.basalt.db-studio",
      "2.11.5",
      "141.0.3537.57",
      "Windows 11",
      "10.0.26200",
      "x86_64",
    ];
    for (const value of shown) {
      expect(screen.queryAllByText(value), value).not.toHaveLength(0);
    }
  });

  // The name and the build number are separate rows because they answer
  // different questions — and because "10.0.26200" alone is how an app ends up
  // looking like it thinks Windows 11 is Windows 10.
  it("names the OS as well as numbering it", async () => {
    mount();
    expect(await screen.findByText("Windows 11")).toBeInTheDocument();
    expect(screen.getByText("10.0.26200")).toBeInTheDocument();
  });

  it("says so when the platform reports no build number", async () => {
    mount({ osName: "Ubuntu", osVersion: null });
    expect(await screen.findByText("Ubuntu")).toBeInTheDocument();
    expect(screen.getByText("unreported")).toBeInTheDocument();
  });

  // The runtime is allowed to decline. An empty cell reads as a rendering fault.
  it("names the unreported webview rather than leaving a gap", async () => {
    mount({ webviewVersion: null });
    expect(await screen.findByText("unreported")).toBeInTheDocument();
  });

  it("flags a debug build twice, and a release build not at all", async () => {
    mount({ debug: true });
    // A badge beside the version for the glance, and the Build row for the
    // record — the copied block reads the same field.
    expect(await screen.findAllByText("debug")).toHaveLength(2);
  });

  it("names a release build without badging it", async () => {
    mount();
    expect(await screen.findByText("release")).toBeInTheDocument();
    expect(screen.queryByText("debug")).not.toBeInTheDocument();
  });

  // The whole reason this pane exists: the facts have to leave as one block
  // somebody can paste, not as eight values read off a screen.
  it("copies every fact as one pasteable block", async () => {
    mount();
    await fireEvent.click(await screen.findByRole("button", { name: /Copy diagnostics/ }));

    expect(write).toHaveBeenCalledOnce();
    const copied = write.mock.calls[0][0];
    expect(copied).toContain("App: Basalt DB Studio 0.1.0");
    expect(copied).toContain("Webview: 141.0.3537.57");
    expect(copied).toContain("OS: Windows 11 (10.0.26200)");
    expect(copied).toContain("Target: windows-x86_64");
  });

  // The clipboard is the one thing here the OS can deny. Swallowing that makes
  // the button look broken. `ToastHost` is mounted at the app root, not here, so
  // the assertion is on the store the host renders from.
  it("says so when the clipboard refuses", async () => {
    write.mockRejectedValue(new Error("denied"));
    mount();
    await fireEvent.click(await screen.findByRole("button", { name: /Copy diagnostics/ }));

    expect(toasts.items.map((t) => t.message)).toContain("Couldn't reach the clipboard");
  });

  it("lets the user retry after the details fail to load", async () => {
    let attempts = 0;
    mockIPC((cmd) => {
      if (cmd !== "app_info") return undefined;
      attempts += 1;
      if (attempts === 1) throw { kind: "internal", message: "IPC unavailable" };
      return INFO;
    });
    render(AboutTab);
    expect(await screen.findByText("IPC unavailable")).toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("heading", { name: "Basalt DB Studio" })).toBeInTheDocument();
    expect(attempts).toBe(2);
  });
});
