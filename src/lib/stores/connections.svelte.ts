import { connectionsApi } from "$lib/api/connections";
import type { ApiError } from "$lib/api/client";
import { toast } from "./toasts.svelte";
import type { ConnectionProfile, SessionInfo } from "$lib/api/types";

export type ConnStatus = "disconnected" | "connecting" | "connected" | "error";

export interface ConnState {
  status: ConnStatus;
  session?: SessionInfo;
  error?: ApiError;
}

let profiles = $state<ConnectionProfile[]>([]);
let statuses = $state<Record<string, ConnState>>({});
let loaded = $state(false);
let loadError = $state<ApiError | null>(null);
/** The session whose schema/editor the main area is showing. */
let active = $state<SessionInfo | null>(null);

// Per-connection passwords, in memory only. A plain Map (not `$state`) on
// purpose: secrets must never become observable/serializable UI state. Set from
// the connection form, consumed at connect time, dropped on delete and on
// reload. The keychain/vault backend replaces this in the secrets slice.
const secrets = new Map<string, string>();

function statusFor(id: string): ConnState {
  return statuses[id] ?? { status: "disconnected" };
}

async function load(): Promise<void> {
  try {
    profiles = await connectionsApi.list();
    loadError = null;
    loaded = true;
  } catch (e) {
    loadError = e as ApiError;
    loaded = true;
  }
}

async function save(profile: ConnectionProfile): Promise<void> {
  await connectionsApi.save(profile);
  await load();
}

async function remove(id: string): Promise<void> {
  const s = statusFor(id);
  if (s.session) {
    if (active?.sessionId === s.session.sessionId) active = null;
    await connectionsApi.disconnect(s.session.sessionId).catch(() => undefined);
  }
  await connectionsApi.remove(id);
  secrets.delete(id);
  delete statuses[id];
  await load();
}

/** Stash a connection's password in memory (empty clears it). Never persisted. */
function setSecret(id: string, password: string): void {
  if (password) secrets.set(id, password);
  else secrets.delete(id);
}

async function connect(id: string): Promise<SessionInfo | null> {
  statuses[id] = { status: "connecting" };
  try {
    const session = await connectionsApi.connect(id, secrets.get(id));
    statuses[id] = { status: "connected", session };
    active = session;
    return session;
  } catch (e) {
    statuses[id] = { status: "error", error: e as ApiError };
    // A failed connect is announced once, here, rather than rendered wherever the
    // click came from: the schema tree, the command palette and the start pane all
    // call this, and an error pinned under a tree row is a message you have to go
    // back and find. The status still carries the error, which is what colours the
    // root's glyph.
    toast.fromError(e, `Connect to “${profiles.find((p) => p.id === id)?.name ?? id}”`);
    return null;
  }
}

async function disconnect(id: string): Promise<void> {
  const s = statusFor(id);
  if (s.session) {
    if (active?.sessionId === s.session.sessionId) active = null;
    await connectionsApi.disconnect(s.session.sessionId).catch(() => undefined);
  }
  statuses[id] = { status: "disconnected" };
}

function setActive(session: SessionInfo): void {
  active = session;
}

/** Open a profile: focus its existing session if it already holds one (a profile
 *  keeps its session when another is made active), otherwise connect it. */
async function activate(id: string): Promise<void> {
  const s = statusFor(id);
  if (s.status === "connected" && s.session) setActive(s.session);
  else await connect(id);
}

export const connections = {
  get profiles() {
    return profiles;
  },
  get loaded() {
    return loaded;
  },
  get loadError() {
    return loadError;
  },
  get active() {
    return active;
  },
  statusFor,
  load,
  save,
  remove,
  setSecret,
  connect,
  disconnect,
  setActive,
  activate,
};
