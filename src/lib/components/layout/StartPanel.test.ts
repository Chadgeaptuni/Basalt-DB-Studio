import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import { SHORTCUT_GROUPS, STARTUP_SHORTCUT_GROUPS } from "$lib/utils/shortcuts";
import StartPanel from "./StartPanel.svelte";

const combos = (groups: typeof SHORTCUT_GROUPS): string[] =>
  groups.flatMap((g) => g.items).flatMap((i) => i.combos);

afterEach(clearMocks);

describe("StartPanel", () => {
  it("says what to do, and offers the one action it owns", () => {
    render(StartPanel);

    expect(
      screen.getByText("Open a connection from the Schema panel to start querying."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New connection" })).toBeInTheDocument();
  });

  // The saved profiles are the schema panel's tree roots. A second list here is a
  // second place to keep in sync, and it is how this pane ended up loading and
  // rendering connections the panel beside it already had.
  it("lists no connections of its own", () => {
    const calls: string[] = [];
    mockIPC((cmd) => {
      calls.push(cmd);
      return undefined;
    });
    render(StartPanel);

    expect(calls).not.toContain("list_connections");
  });

  it("prints the keyboard reference from the catalogue", () => {
    render(StartPanel);

    expect(screen.getByText("Run statement at cursor")).toBeInTheDocument();
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

  it("has no search control of its own", () => {
    render(StartPanel);

    expect(screen.queryByRole("button", { name: /search/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Search tables/)).not.toBeInTheDocument();
  });
});
