import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import { connections } from "$lib/stores/connections.svelte";
import { editorTabs } from "$lib/stores/tabs.svelte";
import DdlPreviewModal from "./DdlPreviewModal.svelte";

afterEach(() => {
  clearMocks();
  connections.setActive(null);
  for (const t of [...editorTabs.list]) editorTabs.close(t.id);
});

describe("DdlPreviewModal", () => {
  // Changing generated SQL happens in the editor, not in a second editor here.
  it("opens the generated SQL in an editor tab instead of running it", async () => {
    const calls: string[] = [];
    mockIPC((cmd) => {
      calls.push(cmd);
      return cmd === "ddl_generate" ? 'DROP TABLE "public"."users";' : undefined;
    });
    connections.setActive({ sessionId: "s-ddl", profileId: "p", engine: "postgres", readOnly: false });
    render(DdlPreviewModal, { request: { kind: "dropTable", namespace: "public", name: "users" } });

    await fireEvent.click(await screen.findByRole("button", { name: "Open in editor" }));

    expect(editorTabs.active?.sql).toBe('DROP TABLE "public"."users";');
    expect(calls).not.toContain("run_query");
  });
});
