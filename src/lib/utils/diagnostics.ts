import type { AppInfo } from "$lib/api/types";
import type { DeviceInfo } from "./device";

// The About tab's facts as one pasteable block. Extracted from the tab because
// the *format* is the thing that has to stay right — an issue template is parsed
// by whoever reads it, and `key: value` lines survive a markdown code fence,
// where the tab's two-column layout does not.
//
// This is why About is worth having at all: the alternative is a maintainer
// asking six questions one at a time.

const rows = (entries: [string, string][]): string =>
  entries.map(([key, value]) => `${key}: ${value}`).join("\n");

export function formatDiagnostics(app: AppInfo, device: DeviceInfo): string {
  return rows([
    ["App", `${app.name} ${app.version}${app.debug ? " (debug build)" : ""}`],
    ["Identifier", app.identifier],
    ["Tauri", app.tauriVersion],
    ["Webview", app.webviewVersion ?? "unreported"],
    // Name and build number together: the name is what a reader recognises, the
    // number is what they can match against a vendor changelog.
    ["OS", app.osVersion ? `${app.osName} (${app.osVersion})` : app.osName],
    ["Target", `${app.os}-${app.arch}`],
    ["Locale", device.locale],
    ["Display", device.display],
  ]);
}
