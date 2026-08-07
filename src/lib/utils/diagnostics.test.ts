import { describe, expect, it } from "vitest";
import type { AppInfo } from "$lib/api/types";
import type { DeviceInfo } from "./device";
import { formatDiagnostics } from "./diagnostics";

const app: AppInfo = {
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

const device: DeviceInfo = { locale: "en-US", display: "2560 × 1440 @ 1.5x" };

const lines = (text: string): Map<string, string> =>
  new Map(
    text.split("\n").map((line) => {
      const at = line.indexOf(": ");
      return [line.slice(0, at), line.slice(at + 2)];
    }),
  );

describe("formatDiagnostics", () => {
  it("emits one key: value per line, so it survives a code fence", () => {
    const found = lines(formatDiagnostics(app, device));

    expect(found.get("App")).toBe("Basalt DB Studio 0.1.0");
    expect(found.get("Identifier")).toBe("com.basalt.db-studio");
    expect(found.get("Tauri")).toBe("2.11.5");
    expect(found.get("Webview")).toBe("141.0.3537.57");
    expect(found.get("OS")).toBe("Windows 11 (10.0.26200)");
    expect(found.get("Target")).toBe("windows-x86_64");
    expect(found.get("Locale")).toBe("en-US");
    expect(found.get("Display")).toBe("2560 × 1440 @ 1.5x");
  });

  // A debug build's timings and bundle size are nothing like a release, so a
  // report that omits it sends the reader chasing the wrong numbers.
  it("marks a debug build on the line naming the version", () => {
    expect(lines(formatDiagnostics({ ...app, debug: true }, device)).get("App")).toBe(
      "Basalt DB Studio 0.1.0 (debug build)",
    );
  });

  // The runtime is allowed not to report it. Saying so beats an empty value that
  // reads like the field failed to render.
  it("says so when the webview version is unreported", () => {
    expect(lines(formatDiagnostics({ ...app, webviewVersion: null }, device)).get("Webview")).toBe(
      "unreported",
    );
  });

  // Some Linux distributions report no build number at all. The name alone is a
  // complete answer there, and an empty bracket after it would not be.
  it("drops the build number when the platform gives none", () => {
    const found = lines(formatDiagnostics({ ...app, osName: "Ubuntu", osVersion: null }, device));
    expect(found.get("OS")).toBe("Ubuntu");
  });
});
