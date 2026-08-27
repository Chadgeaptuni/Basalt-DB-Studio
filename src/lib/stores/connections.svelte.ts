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
// A Postgres database node is its own session: a pg connection can never leave
// the database it opened, so browsing a second database on the same server means
// a second pool, not a re-pointed one. Keyed profile + database because two
// servers both having a `postgres` database is the normal case. Held apart from
// `statuses` so a profile still has exactly one server session — the one the
// database list is discovered over.
let dbStatuses = $state<Record<string, ConnState>>({});
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

/** NUL, as in the schema store: it cannot occur in an identifier, so no database
 *  name can forge a key belonging to another profile. */
function dbKey(profileId: string, database: string): string {
  return `${profileId}\u0000${database}`;
}

function dbStatusFor(profileId: string, database: string): ConnState {
  return dbStatuses[dbKey(profileId, database)] ?? { status: "disconnected" };
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
  await disconnectDatabases(id);
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

function profileName(id: string): string {
  return profiles.find((p) => p.id === id)?.name ?? id;
}

/** Opens a session and files it under `key` in `into`. The server session and a
 *  database session differ only in which map holds them and whether a database
 *  overrides the profile's — everything else, including the failure handling, is
 *  the same connect. */
async function openSession(
  id: string,
  database: string | undefined,
  into: Record<string, ConnState>,
  key: string,
  label: string,
): Promise<SessionInfo | null> {
  into[key] = { status: "connecting" };
  try {
    const session = await connectionsApi.connect(id, secrets.get(id), database);
    into[key] = { status: "connected", session };
    active = session;
    return session;
  } catch (e) {
    into[key] = { status: "error", error: e as ApiError };
    // A failed connect is announced once, here, rather than rendered wherever the
    // click came from: the schema tree, the command palette and the start pane all
    // call this, and an error pinned under a tree row is a message you have to go
    // back and find. The status still carries the error, which is what colours the
    // root's glyph.
    toast.fromError(e, `Connect to “${label}”`);
    return null;
  }
}

async function connect(id: string): Promise<SessionInfo | null> {
  return openSession(id, undefined, statuses, id, profileName(id));
}

/** Opens one Postgres database on an already-connected server as its own
 *  session. Re-opening a database that is already connected just focuses it —
 *  the pool is the expensive part and it is already paid for. */
async function connectDatabase(
  profileId: string,
  database: string,
): Promise<SessionInfo | null> {
  const existing = dbStatusFor(profileId, database);
  if (existing.status === "connected" && existing.session) {
    active = existing.session;
    return existing.session;
  }
  return openSession(
    profileId,
    database,
    dbStatuses,
    dbKey(profileId, database),
    `${profileName(profileId)}/${database}`,
  );
}

async function disconnectDatabase(profileId: string, database: string): Promise<void> {
  const key = dbKey(profileId, database);
  const session = dbStatuses[key]?.session;
  if (session) {
    if (active?.sessionId === session.sessionId) active = null;
    await connectionsApi.disconnect(session.sessionId).catch(() => undefined);
  }
  delete dbStatuses[key];
}

/** Closes every database session opened under a profile. Called wherever the
 *  server session goes away, because a database session outliving the server it
 *  was discovered through is a pool nothing in the tree can reach. */
async function disconnectDatabases(profileId: string): Promise<void> {
  const prefix = dbKey(profileId, "");
  await Promise.all(
    Object.keys(dbStatuses)
      .filter((key) => key.startsWith(prefix))
      .map((key) => disconnectDatabase(profileId, key.slice(prefix.length))),
  );
}

async function disconnect(id: string): Promise<void> {
  await disconnectDatabases(id);
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
  dbStatusFor,
  load,
  save,
  remove,
  setSecret,
  connect,
  connectDatabase,
  disconnect,
  disconnectDatabase,
  setActive,
  activate,
};
