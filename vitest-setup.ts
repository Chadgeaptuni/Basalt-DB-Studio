import "@testing-library/jest-dom/vitest";

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Svelte transitions use the Web Animations API, which jsdom does not provide.
// Finish animations on the next microtask so transition-driven overlays can be
// tested without changing their production timing behavior.
if (typeof Element.prototype.animate !== "function") {
  Element.prototype.animate = function () {
    const animation = {
      currentTime: 0,
      effect: null,
      onfinish: null as ((event: AnimationPlaybackEvent) => void) | null,
      playState: "finished",
      cancel() {},
    };
    queueMicrotask(() => animation.onfinish?.(new Event("finish") as AnimationPlaybackEvent));
    return animation as unknown as Animation;
  };
}

// jsdom under vitest doesn't always expose localStorage as a global; stores read it
// at import time, so install a minimal in-memory shim when it's missing.
if (typeof globalThis.localStorage === "undefined") {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => void store.set(k, String(v)),
    removeItem: (k) => void store.delete(k),
    clear: () => store.clear(),
    key: (i) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}
