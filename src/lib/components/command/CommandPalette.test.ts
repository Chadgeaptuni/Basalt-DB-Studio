import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockIPC, clearMocks } from "@tauri-apps/api/mocks";
import { connections } from "$lib/stores/connections.svelte";
import { schema } from "$lib/stores/schema.svelte";
import { editorTabs } from "$lib/stores/tabs.svelte";
import { panel } from "$lib/stores/panel.svelte";
import CommandPalette from "./CommandPalette.svelte";

// A session with a small schema, so the palette has tables to find.
const SESSION = "sess-1";

const tree = {
  namespaces: [
    {
      name: "public",
      relations: [
        { name: "users", kind: "table" as const },
        { name: "order_items", kind: "table" as const },
        { name: "active_users", kind: "view" as const },
      ],
    },
  ],
};

const ipcCalls: string[] = [];

beforeEach(async () => {
  ipcCalls.length = 0;
  mockIPC((cmd) => {
    ipcCalls.push(cmd);
    if (cmd === "introspect") return tree;
    if (cmd === "list_saved_queries") return [];
    if (cmd === "list_connections") return [];
    return null;
  });
  await schema.loadTree(SESSION);
  panel.select("schema");
  panel.setCollapsed(false);
});

afterEach(() => {
  schema.clear(SESSION);
  clearMocks();
});

describe("CommandPalette", () => {
  it("finds tables by subsequence, not just prefix", async () => {
    vi.spyOn(connections, "active", "get").mockReturnValue({ sessionId: SESSION } as never);
    render(CommandPalette, { onclose: () => {} });

    const field = await screen.findByRole("textbox", { name: /search tables/i });
    await fireEvent.input(field, { target: { value: "ordit" } });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /order_items/ })).toBeInTheDocument(),
    );
    expect(screen.queryByRole("button", { name: /^users/ })).not.toBeInTheDocument();
  });

  it("offers actions even with no connection", async () => {
    vi.spyOn(connections, "active", "get").mockReturnValue(null as never);
    render(CommandPalette, { onclose: () => {} });

    const field = await screen.findByRole("textbox", { name: /search tables/i });
    await fireEvent.input(field, { target: { value: "history" } });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Go to History/ })).toBeInTheDocument(),
    );
  });

  it("runs the highlighted item on Enter and closes", async () => {
    vi.spyOn(connections, "active", "get").mockReturnValue(null as never);
    const onclose = vi.fn();
    render(CommandPalette, { onclose });

    const field = await screen.findByRole("textbox", { name: /search tables/i });
    await fireEvent.input(field, { target: { value: "Go to History" } });
    await waitFor(() => expect(screen.getByRole("option", { selected: true })).toBeInTheDocument());
    await fireEvent.keyDown(field, { key: "Enter" });

    expect(panel.active).toBe("history");
    expect(onclose).toHaveBeenCalledOnce();
  });

  it("moves the highlight with the arrow keys", async () => {
    vi.spyOn(connections, "active", "get").mockReturnValue({ sessionId: SESSION } as never);
    render(CommandPalette, { onclose: () => {} });

    const field = await screen.findByRole("textbox", { name: /search tables/i });
    await fireEvent.input(field, { target: { value: "users" } });
    await waitFor(() => expect(screen.getAllByRole("option").length).toBeGreaterThan(1));

    const first = screen.getAllByRole("option")[0];
    expect(first).toHaveAttribute("aria-selected", "true");

    await fireEvent.keyDown(field, { key: "ArrowDown" });
    expect(screen.getAllByRole("option")[1]).toHaveAttribute("aria-selected", "true");
  });

  // Regression: a new query must reset the highlight, or Enter fires whatever
  // happened to sit at the previous index.
  it("resets the highlight when the query changes", async () => {
    vi.spyOn(connections, "active", "get").mockReturnValue({ sessionId: SESSION } as never);
    render(CommandPalette, { onclose: () => {} });

    const field = await screen.findByRole("textbox", { name: /search tables/i });
    await fireEvent.input(field, { target: { value: "users" } });
    await waitFor(() => expect(screen.getAllByRole("option").length).toBeGreaterThan(1));
    await fireEvent.keyDown(field, { key: "ArrowDown" });

    await fireEvent.input(field, { target: { value: "order" } });

    await waitFor(() =>
      expect(screen.getAllByRole("option")[0]).toHaveAttribute("aria-selected", "true"),
    );
  });

  // DESIGN §10: a keystroke filters the cached tree and must not reach the
  // backend. Asserted by counting IPC, because "it feels fast" is not a check.
  it("costs no IPC per keystroke", async () => {
    vi.spyOn(connections, "active", "get").mockReturnValue({ sessionId: SESSION } as never);
    render(CommandPalette, { onclose: () => {} });
    const field = await screen.findByRole("textbox", { name: /search tables/i });

    ipcCalls.length = 0;
    for (const value of ["u", "us", "use", "user", "users"]) {
      await fireEvent.input(field, { target: { value } });
    }

    expect(ipcCalls).toEqual([]);
  });

  it("stays responsive on a large schema", async () => {
    const big = {
      namespaces: [
        {
          name: "public",
          relations: Array.from({ length: 300 }, (_, i) => ({
            name: `table_${i}`,
            kind: "table" as const,
          })),
        },
      ],
    };
    mockIPC((cmd) => (cmd === "introspect" ? big : null));
    await schema.loadTree(SESSION);
    vi.spyOn(connections, "active", "get").mockReturnValue({ sessionId: SESSION } as never);

    render(CommandPalette, { onclose: () => {} });
    const field = await screen.findByRole("textbox", { name: /search tables/i });
    await fireEvent.input(field, { target: { value: "table_299" } });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /table_299/ })).toBeInTheDocument(),
    );
    // The list is capped, and says so rather than silently truncating.
    await fireEvent.input(field, { target: { value: "t" } });
    await waitFor(() => expect(screen.getByText(/more — keep typing/)).toBeInTheDocument());
  });

  it("reports a query that matches nothing", async () => {
    vi.spyOn(connections, "active", "get").mockReturnValue({ sessionId: SESSION } as never);
    render(CommandPalette, { onclose: () => {} });

    const field = await screen.findByRole("textbox", { name: /search tables/i });
    await fireEvent.input(field, { target: { value: "zzzzz" } });

    await waitFor(() => expect(screen.getByText(/Nothing matches/)).toBeInTheDocument());
  });

  it("opens a table's data view when chosen", async () => {
    vi.spyOn(connections, "active", "get").mockReturnValue({ sessionId: SESSION } as never);
    const before = editorTabs.list.length;
    render(CommandPalette, { onclose: () => {} });

    const field = await screen.findByRole("textbox", { name: /search tables/i });
    await fireEvent.input(field, { target: { value: "order_items" } });
    await waitFor(() => expect(screen.getByRole("button", { name: /order_items/ })).toBeInTheDocument());
    await fireEvent.click(screen.getByRole("button", { name: /order_items/ }));

    expect(editorTabs.list.length).toBe(before + 1);
  });
});
