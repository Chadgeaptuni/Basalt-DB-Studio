// What the webview already knows about the machine. No IPC and no plugin: these
// two are the only device facts a browser reports accurately, and both matter in
// a bug report — a locale explains a date that renders unexpectedly, and a
// display explains a layout complaint.
//
// Everything the webview reports *badly* is read from Rust instead
// (`api/appInfo.ts`); WebView2 froze its user agent at "Windows NT 10.0" for
// Windows 11, so anything OS-shaped taken from here would be confidently wrong.

export interface DeviceInfo {
  locale: string;
  /** `2560 × 1440` — with `@ 2x` appended when the screen is scaled. */
  display: string;
}

const UNKNOWN = "unknown";

export function deviceInfo(): DeviceInfo {
  const { width, height } = window.screen ?? { width: 0, height: 0 };
  // `devicePixelRatio` is the OS scale factor. The app's own zoom does not touch
  // it, so this stays the physical display even at 150%.
  const ratio = window.devicePixelRatio;
  const scale = ratio && ratio !== 1 ? ` @ ${Number(ratio.toFixed(2))}x` : "";

  return {
    locale: navigator.language || UNKNOWN,
    display: width > 0 && height > 0 ? `${width} × ${height}${scale}` : UNKNOWN,
  };
}
