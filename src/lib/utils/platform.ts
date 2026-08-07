// The one platform check. It was inlined in `keyboard.ts` when only the shortcut
// labels cared; the title bar cares too — and the two disagreeing about what a
// Mac is would put the traffic lights and our own buttons on the same window.
//
// Read from the webview rather than `@tauri-apps/plugin-os`: the answer is a
// boolean, and a plugin (JS package + Rust crate + a permission) is a lot of
// bundle for it under the 30 MB ceiling.

/** macOS or an iOS-family webview. `navigator.platform` reports "MacIntel" on
 *  Apple Silicon too, which is why the test is a family match, not equality. */
export const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * macOS draws its own window buttons; we draw ours everywhere else.
 *
 * The traffic lights are a system control with system behaviour (green =
 * fullscreen, not maximize) and a position users expect to the pixel — so the
 * app keeps them via `titleBarStyle: "Overlay"` and simply leaves room. Windows
 * and Linux get `decorations: false` and our own buttons.
 */
export const USE_CUSTOM_WINDOW_CONTROLS = !IS_MAC;

/** Width the macOS traffic lights occupy, in px. The overlay title bar floats
 *  them over our content, so the top bar has to inset its leading edge or the
 *  brand mark sits underneath them. */
export const MAC_TRAFFIC_LIGHT_INSET = 78;
