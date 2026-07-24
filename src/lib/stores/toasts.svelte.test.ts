import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { toast, toasts } from "./toasts.svelte";

function clear(): void {
  while (toasts.items.length) toasts.dismiss(toasts.items[0].id);
}

describe("toasts", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clear();
  });
  afterEach(() => vi.useRealTimers());

  it("pushes and auto-dismisses non-sticky toasts", () => {
    toast.success("saved");
    expect(toasts.items).toHaveLength(1);
    vi.advanceTimersByTime(4000);
    expect(toasts.items).toHaveLength(0);
  });

  it("gives errors an 8s lifetime", () => {
    toast.error("boom");
    vi.advanceTimersByTime(4000);
    expect(toasts.items).toHaveLength(1);
    vi.advanceTimersByTime(4000);
    expect(toasts.items).toHaveLength(0);
  });

  it("keeps toasts with an action sticky", () => {
    toast.error("boom", { action: { label: "Retry", run: () => {} } });
    vi.advanceTimersByTime(60_000);
    expect(toasts.items).toHaveLength(1);
  });
});
