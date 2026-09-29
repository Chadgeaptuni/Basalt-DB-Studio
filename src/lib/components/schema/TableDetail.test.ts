import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import type { Engine } from "$lib/api/types";
import { ddl } from "$lib/stores/ddl.svelte";
import { schema } from "$lib/stores/schema.svelte";
import TableDetail from "./TableDetail.svelte";

async function renderFor(engine: Engine): Promise<void> {
  const sessionId = `s-${engine}`;
  mockIPC((cmd) =>
    cmd === "describe_table"
      ? {
          columns: [{ name: "email", typeName: "text", nullable: true, isPk: false }],
          indexes: [{ name: "users_email_idx", columns: ["email"], unique: true }],
        }
      : undefined,
  );
  await schema.describe(sessionId, "public", "users");
  render(TableDetail, { sessionId, namespace: "public", table: "users", engine, indent: 0, activate: () => {} });
}

afterEach(() => {
  clearMocks();
  ddl.close();
});

describe("TableDetail", () => {
  it("lists indexes under the columns and drops one through the preview", async () => {
    await renderFor("postgres");
    expect(screen.getByText("(email)")).toBeInTheDocument();

    await fireEvent.contextMenu(screen.getByText("users_email_idx"), { clientX: 10, clientY: 10 });
    await fireEvent.click(await screen.findByRole("menuitem", { name: "Drop index" }));

    expect(ddl.active).toEqual({
      type: "preview",
      request: { kind: "dropIndex", namespace: "public", table: "users", name: "users_email_idx" },
    });
  });

  it("changes a column with its current definition as the seed", async () => {
    await renderFor("postgres");
    await fireEvent.contextMenu(screen.getByText("email"), { clientX: 10, clientY: 10 });
    await fireEvent.click(await screen.findByRole("menuitem", { name: "Change column…" }));

    expect(ddl.active).toMatchObject({
      type: "column",
      column: { name: "email", typeName: "text", nullable: true },
    });
  });

  // SQLite's ALTER TABLE only renames, adds and drops.
  it("offers no column change on SQLite", async () => {
    await renderFor("sqlite");
    await fireEvent.contextMenu(screen.getByText("email"), { clientX: 10, clientY: 10 });

    expect(await screen.findByRole("menuitem", { name: "Rename column…" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Change column…" })).toBeNull();
  });
});
