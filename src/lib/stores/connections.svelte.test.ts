import { describe, it, expect, afterEach } from "vitest";
import { mockIPC, clearMocks } from "@tauri-apps/api/mocks";
import { connections } from "./connections.svelte";
import type { ConnectionProfile } from "$lib/api/types";

const sqliteProfile: ConnectionProfile = {
  id: "p1",
  name: "local",
  engine: "sqlite",
  readOnly: false,
  filePath: "/tmp/x.db",
};

describe("connections store", () => {
  afterEach(() => clearMocks());

  it("loads profiles from the backend", async () => {
    mockIPC((cmd) => {
      if (cmd === "list_connections") return [sqliteProfile];
      return undefined;
    });
    await connections.load();
    expect(connections.loaded).toBe(true);
    expect(connections.loadError).toBeNull();
    expect(connections.profiles.map((p) => p.id)).toContain("p1");
  });

  it("marks a session connected and active on success", async () => {
    mockIPC((cmd) => {
      if (cmd === "connect") {
        return { sessionId: "s1", profileId: "p1", engine: "sqlite", readOnly: false };
      }
      return undefined;
    });
    const session = await connections.connect("p1");
    expect(session?.sessionId).toBe("s1");
    expect(connections.statusFor("p1").status).toBe("connected");
    expect(connections.active?.sessionId).toBe("s1");
  });

  it("activates an existing session instead of opening a second one", async () => {
    let connects = 0;
    mockIPC((cmd) => {
      if (cmd === "connect") {
        connects += 1;
        return { sessionId: `s${connects}`, profileId: "p1", engine: "sqlite", readOnly: false };
      }
      return undefined;
    });

    await connections.activate("p-act"); // first open → connects
    connections.setActive({ sessionId: "other", profileId: "p9", engine: "sqlite", readOnly: false });
    await connections.activate("p-act"); // already holds a session → refocus

    expect(connects).toBe(1);
    expect(connections.active?.sessionId).toBe("s1");
  });

  it("captures a typed connect failure as an error status", async () => {
    mockIPC((cmd) => {
      if (cmd === "connect") throw { kind: "connectionRefused", message: "refused" };
      return undefined;
    });
    const session = await connections.connect("p2");
    expect(session).toBeNull();
    const st = connections.statusFor("p2");
    expect(st.status).toBe("error");
    expect(st.error?.kind).toBe("connectionRefused");
  });
});
