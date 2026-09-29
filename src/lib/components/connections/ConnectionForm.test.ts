import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import type { ConnectionProfile } from "$lib/api/types";
import ConnectionForm from "./ConnectionForm.svelte";

const saved: ConnectionProfile = {
  id: "p-form",
  name: "warehouse",
  engine: "postgres",
  readOnly: false,
  host: "db.internal",
  port: 5432,
  secretRef: "ref-1",
};

function captureSaves(): unknown[] {
  const saves: unknown[] = [];
  mockIPC((cmd, args) => {
    if (cmd === "save_connection") saves.push(args);
    if (cmd === "list_connections") return [];
    return undefined;
  });
  return saves;
}

afterEach(clearMocks);

describe("ConnectionForm", () => {
  it("saves a new connection's password to the keychain by default", async () => {
    const saves = captureSaves();
    render(ConnectionForm, { profile: null, onclose: () => {} });

    await fireEvent.input(screen.getByPlaceholderText("My database"), { target: { value: "local" } });
    await fireEvent.input(screen.getByLabelText("Password"), { target: { value: "hunter2" } });
    await fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(saves).toHaveLength(1));
    expect(saves[0]).toMatchObject({ secret: { password: "hunter2" }, remember: true });
  });

  // A blank field on edit means "keep the saved password": the secret goes up
  // empty and the profile keeps pointing at its keychain entry.
  it("keeps the saved password when the field is left blank", async () => {
    const saves = captureSaves();
    render(ConnectionForm, { profile: saved, onclose: () => {} });

    expect(screen.getByText("Saved in the OS keychain. Leave blank to keep it.")).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(saves).toHaveLength(1));
    expect(saves[0]).toMatchObject({ profile: { secretRef: "ref-1" }, secret: {}, remember: true });
  });
});
