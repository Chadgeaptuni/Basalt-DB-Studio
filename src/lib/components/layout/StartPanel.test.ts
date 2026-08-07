import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import type { ConnectionProfile } from "$lib/api/types";
import { SHORTCUT_GROUPS, STARTUP_SHORTCUT_GROUPS } from "$lib/utils/shortcuts";
import StartPanel from "./StartPanel.svelte";

const profile: ConnectionProfile = {
  id: "p1",
  name: "warehouse",
  engine: "postgres",
  readOnly: false,
  host: "localhost",
  port: 5432,
  database: "analytics",
};

const combos = (groups: typeof SHORTCUT_GROUPS): string[] =>
  groups.flatMap((g) => g.items).flatMap((i) => i.combos);

afterEach(clearMocks);

describe("StartPanel", () => {
  it("offers the connections already saved, and connects on click", async () => {
    const calls: string[] = [];
    mockIPC((cmd) => {
      calls.push(cmd);
      if (cmd === "list_connections") return [profile];
      if (cmd === "connect") {
        return { sessionId: "s1", profileId: "p1", engine: "postgres", readOnly: false };
      }
      return undefined;
    });
    render(StartPanel);

    await fireEvent.click(await screen.findByRole("button", { name: /warehouse/ }));
    expect(calls).toContain("connect");
  });

  it("says what to do when there are none", async () => {
    mockIPC((cmd) => (cmd === "list_connections" ? [] : undefined));
    render(StartPanel);

    expect(
      await screen.findByText("Connect to a database to start querying."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New connection" })).toBeInTheDocument();
  });

  it("lets the user retry after the profiles fail to load", async () => {
    let attempts = 0;
    mockIPC((cmd) => {
      if (cmd !== "list_connections") return undefined;
      attempts += 1;
      if (attempts === 1) throw { kind: "configIo", message: "Config directory is unreadable" };
      return [profile];
    });
    render(StartPanel);
    expect(await screen.findByText("Config directory is unreadable")).toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("button", { name: /warehouse/ })).toBeInTheDocument();
    expect(attempts).toBe(2);
  });

  it("prints the keyboard reference from the catalogue", async () => {
    mockIPC((cmd) => (cmd === "list_connections" ? [] : undefined));
    render(StartPanel);

    expect(await screen.findByText("Run statement at cursor")).toBeInTheDocument();
    // One box per key and no separator between them, so the chord is the boxes.
    const chord = screen.getByText("Run statement at cursor").closest("li");
    expect([...(chord?.querySelectorAll("kbd kbd") ?? [])].map((k) => k.textContent?.trim())).toEqual([
      "⌘",
      "↵",
    ]);
  });

  // The top bar prints ⌘K on the search control itself, on this same screen. The
  // catalogue still carries it — the settings reference is a complete list — so
  // the filter is what has to hold, and it is one `combos.includes` away from
  // silently lapsing when someone reorders the groups.
  it("keeps the palette binding off the pane that already shows it", () => {
    expect(combos(SHORTCUT_GROUPS)).toContain("mod+k");
    expect(combos(STARTUP_SHORTCUT_GROUPS)).not.toContain("mod+k");
  });

  it("has no search control of its own", async () => {
    mockIPC((cmd) => (cmd === "list_connections" ? [] : undefined));
    render(StartPanel);
    await screen.findByRole("button", { name: "New connection" });

    expect(screen.queryByRole("button", { name: /search/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Search tables/)).not.toBeInTheDocument();
  });
});
