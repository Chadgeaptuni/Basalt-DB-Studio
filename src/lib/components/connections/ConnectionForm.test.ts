import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import type { ConnectionProfile, SshHost } from "$lib/api/types";
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

function captureSaves(sshHosts: SshHost[] = []): unknown[] {
  const saves: unknown[] = [];
  mockIPC((cmd, args) => {
    if (cmd === "save_connection") saves.push(args);
    if (cmd === "list_connections") return [];
    if (cmd === "list_ssh_hosts") return sshHosts;
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

  it("saves an SSH tunnel with the profile once its host and user are set", async () => {
    const saves = captureSaves();
    render(ConnectionForm, { profile: saved, onclose: () => {} });

    await fireEvent.click(screen.getByLabelText("Connect through an SSH tunnel"));
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled(); // no SSH host or user yet

    await fireEvent.input(screen.getByPlaceholderText("bastion.example.com"), {
      target: { value: "bastion" },
    });
    await fireEvent.input(screen.getByLabelText("SSH user"), { target: { value: "deploy" } });
    await fireEvent.click(save);

    await waitFor(() => expect(saves).toHaveLength(1));
    expect(saves[0]).toMatchObject({
      profile: { ssh: { host: "bastion", port: 22, user: "deploy", authKind: "agent" } },
    });
  });

  it("fills the tunnel, and the database from its LocalForward, from a saved SSH host", async () => {
    const tunnel = {
      host: "bastion.example.com",
      port: 2222,
      user: "deploy",
      authKind: "key" as const,
      keyPath: "~/.ssh/id_ed25519",
    };
    const saves = captureSaves([{ alias: "staging", ssh: tunnel, forward: { host: "pg.internal", port: 5433 } }]);
    render(ConnectionForm, { profile: saved, onclose: () => {} });

    await fireEvent.click(screen.getByLabelText("Connect through an SSH tunnel"));
    // bits-ui opens on pointerdown and commits on pointerup (see Select.test.ts).
    const picker = await screen.findByRole("button", { name: "Saved host" });
    await fireEvent.pointerDown(picker, { button: 0, pointerType: "mouse" });
    await fireEvent.pointerUp(await screen.findByRole("option", { name: "staging" }), { pointerType: "mouse" });
    await fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(saves).toHaveLength(1));
    expect(saves[0]).toMatchObject({ profile: { host: "pg.internal", port: 5433, ssh: tunnel } });
  });
});
