import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import { connections } from "$lib/stores/connections.svelte";
import { editorTabs } from "$lib/stores/tabs.svelte";
import EditorPane from "./EditorPane.svelte";

afterEach(() => {
  clearMocks();
  connections.setActive(null);
  for (const t of [...editorTabs.list]) editorTabs.close(t.id);
});

describe("EditorPane", () => {
  // Run becomes Cancel for as long as the statement runs, and Cancel goes to the
  // session the run went to.
  it("cancels a running query from the toolbar and with Escape", async () => {
    const calls: { cmd: string; args: unknown }[] = [];
    let finish: (v: unknown) => void = () => {};
    mockIPC((cmd, args) => {
      calls.push({ cmd, args });
      if (cmd === "run_query") return new Promise((resolve) => (finish = resolve));
      return undefined;
    });
    connections.setActive({ sessionId: "s-run", profileId: "p", engine: "sqlite", readOnly: false });
    editorTabs.open("SELECT 1");
    render(EditorPane);

    await fireEvent.click(screen.getByRole("button", { name: /Run/ }));
    await fireEvent.click(await screen.findByRole("button", { name: /Cancel/ }));
    await fireEvent.keyDown(window, { key: "Escape" });

    const cancels = calls.filter((c) => c.cmd === "cancel_query");
    expect(cancels).toHaveLength(2);
    expect(cancels[0].args).toMatchObject({ sessionId: "s-run" });

    finish({ statements: [], txStatus: "idle" });
    expect(await screen.findByRole("button", { name: /Run/ })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("button", { name: /Cancel/ })).toBeNull());
  });
});
