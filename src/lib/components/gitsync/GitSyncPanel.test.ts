import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import type { GitStatus } from "$lib/api/gitsync";
import { dialogs } from "$lib/stores/dialogs.svelte";
import GitSyncPanel from "./GitSyncPanel.svelte";

const CLEAN: GitStatus = {
  installed: true,
  isRepo: true,
  hasRemote: true,
  branch: "main",
  upstream: "origin/main",
  ahead: 0,
  behind: 0,
  staged: [],
  unstaged: [],
  conflicted: [],
  inProgress: false,
};

/** Records every command the panel invoked, so an action can be asserted on. */
function mount(status: Partial<GitStatus> = {}, fail?: { cmd: string; error: unknown }) {
  const calls: { cmd: string; args: Record<string, unknown> }[] = [];
  mockIPC((cmd, args) => {
    calls.push({ cmd, args: (args ?? {}) as Record<string, unknown> });
    if (fail && cmd === fail.cmd) throw fail.error;
    if (cmd === "git_status") return { ...CLEAN, ...status };
    if (cmd === "git_branches") return [{ name: "main", current: true, remote: false }];
    return undefined;
  });
  render(GitSyncPanel);
  return calls;
}

afterEach(clearMocks);

describe("GitSyncPanel", () => {
  it("sends the user to install git rather than showing a broken panel", async () => {
    mount({ installed: false, isRepo: false });
    expect(await screen.findByText("Git isn't installed.")).toBeInTheDocument();
  });

  // A config dir that is not a repo yet is the ordinary first run, not a fault.
  it("offers to initialize a config dir that is not a repo", async () => {
    const calls = mount({ isRepo: false });

    await fireEvent.click(await screen.findByRole("button", { name: "Initialize repository" }));
    await waitFor(() => expect(calls.map((c) => c.cmd)).toContain("git_init"));
  });

  it("lists staged and unstaged changes apart", async () => {
    mount({
      staged: [{ path: "connections/a.toml", state: "modified" }],
      unstaged: [{ path: "queries/b.sql", state: "untracked" }],
    });

    expect(await screen.findByText("Staged")).toBeInTheDocument();
    expect(screen.getByText("Changes")).toBeInTheDocument();
    expect(screen.getByText("connections/")).toBeInTheDocument();
    expect(screen.getByText("b.sql")).toBeInTheDocument();
  });

  it("stages one file at a time", async () => {
    const calls = mount({ unstaged: [{ path: "queries/b.sql", state: "modified" }] });

    await fireEvent.click(await screen.findByRole("button", { name: "Stage" }));

    await waitFor(() => {
      const staged = calls.find((c) => c.cmd === "git_stage");
      expect(staged?.args.paths).toEqual(["queries/b.sql"]);
    });
  });

  // Git keeps no copy of a working-tree change that was never committed, so this
  // is the one action here that is genuinely unrecoverable.
  it("will not discard without confirming, and names the file", async () => {
    const calls = mount({ unstaged: [{ path: "queries/b.sql", state: "modified" }] });

    await fireEvent.click(await screen.findByRole("button", { name: "Discard changes" }));

    await waitFor(() => expect(dialogs.active?.title).toBe("Discard changes to queries/b.sql?"));
    expect(dialogs.active?.variant).toBe("danger");
    expect(calls.some((c) => c.cmd === "git_discard")).toBe(false);

    dialogs.cancel();
    await waitFor(() => expect(dialogs.active).toBeNull());
    expect(calls.some((c) => c.cmd === "git_discard")).toBe(false);
  });

  it("commits only once there is a message and something staged", async () => {
    const calls = mount({ staged: [{ path: "queries/b.sql", state: "modified" }] });

    const commit = await screen.findByRole("button", { name: /^Commit/ });
    expect(commit).toBeDisabled();

    await fireEvent.input(screen.getByRole("textbox", { name: "Commit message" }), {
      target: { value: "add b" },
    });
    expect(commit).toBeEnabled();

    await fireEvent.click(commit);
    await waitFor(() => {
      const sent = calls.find((c) => c.cmd === "git_commit");
      expect(sent?.args.message).toBe("add b");
    });
  });

  // The whole point of the auth work: the panel says which machinery to fix,
  // because it is not this app's to fix.
  it("points a credential failure at the system's git, not at a login form", async () => {
    mount(
      { ahead: 1 },
      { cmd: "git_push", error: { kind: "gitAuthFailed", message: "git could not authenticate" } },
    );

    await fireEvent.click(await screen.findByRole("button", { name: "Push" }));

    expect(await screen.findByText("Git couldn't authenticate with the remote")).toBeInTheDocument();
    expect(screen.getByText(/Git Credential Manager/)).toBeInTheDocument();
    // No password field anywhere — Basalt has nowhere to put the answer.
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
  });

  it("tells the user to pull when the remote has moved on", async () => {
    mount(
      { ahead: 1 },
      {
        cmd: "git_push",
        error: { kind: "gitPushRejected", message: "the remote has commits this copy does not" },
      },
    );

    await fireEvent.click(await screen.findByRole("button", { name: "Push" }));
    expect(await screen.findByText("The remote has commits this copy doesn't")).toBeInTheDocument();
  });

  // Resolving a conflict is text editing, which this app does not do. Offering
  // stage buttons on a conflicted file would promise a job it cannot finish.
  it("lists conflicts without offering to stage them", async () => {
    mount({ conflicted: [{ path: "queries/b.sql", state: "conflicted" }] });

    expect(await screen.findByText("Conflicts")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Stage" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Discard changes" })).not.toBeInTheDocument();
  });

  it("offers a remote when there is none, and push/pull when there is", async () => {
    mount({ hasRemote: false });

    expect(await screen.findByRole("button", { name: "Add a remote" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Push" })).not.toBeInTheDocument();
  });
});
