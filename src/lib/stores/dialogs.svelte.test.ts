import { describe, it, expect } from "vitest";
import { confirm, dialogs } from "./dialogs.svelte";

describe("dialogs.confirm", () => {
  it("resolves true on accept and clears the active dialog", async () => {
    const p = confirm({ title: "Drop table?" });
    expect(dialogs.active?.title).toBe("Drop table?");
    dialogs.accept();
    await expect(p).resolves.toBe(true);
    expect(dialogs.active).toBeNull();
  });

  it("resolves false on cancel", async () => {
    const p = confirm({ title: "X" });
    dialogs.cancel();
    await expect(p).resolves.toBe(false);
  });

  it("supersedes an open confirm, resolving the old one false", async () => {
    const first = confirm({ title: "first" });
    const second = confirm({ title: "second" });
    await expect(first).resolves.toBe(false);
    expect(dialogs.active?.title).toBe("second");
    dialogs.accept();
    await expect(second).resolves.toBe(true);
  });
});
