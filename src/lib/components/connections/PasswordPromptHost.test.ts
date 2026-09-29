import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import { connections } from "$lib/stores/connections.svelte";
import PasswordPromptHost from "./PasswordPromptHost.svelte";

afterEach(() => {
  connections.passwordRequest?.answer(null);
  clearMocks();
});

describe("PasswordPromptHost", () => {
  // The kind's title alone ("Authentication failed") hid which account the
  // server refused, which is what decides the password to type.
  it("names the server's own reason under the field", async () => {
    mockIPC((cmd) => {
      if (cmd === "list_connections") return [{ id: "p-pp", name: "prod", engine: "mysql", readOnly: false }];
      if (cmd === "connect") throw { kind: "authFailed", message: "Access denied for user 'ro'@'10.0.0.4'" };
      return undefined;
    });
    await connections.load();
    render(PasswordPromptHost);

    void connections.connect("p-pp");

    expect(await screen.findByText("Authentication failed: Access denied for user 'ro'@'10.0.0.4'")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Connect" })).toBeDisabled());
  });
});
