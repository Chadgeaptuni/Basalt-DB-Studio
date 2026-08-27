import { connectionsApi } from "$lib/api/connections";
import type { ApiError } from "$lib/api/client";
import { toast } from "./toasts.svelte";
import { schema } from "./schema.svelte";
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

// Connects in flight, keyed as the state maps are. A second caller for the same
// key awaits the first rather than opening a second pool: the tree, the command
// palette and the start pane all connect, a slow server leaves a wide window,
// and the loser of that race was a live pool nothing in the UI could reach again.
const opening = new Map<string, Promise<SessionInfo | null>>();

function statusFor(id: string): ConnState {
  return statuses[id] ?? { status: "disconnected" };
}

/** NUL, as in the schema store: it cannot occur in an identifier, so no database
 *  name can forge a key belonging to another profile. */
function dbKey(profileId: string, database: string): string {
  return `${profileId}\u0000${database}`;
}

/** Every session a profile holds — its server session first, then one per
 *  Postgres database opened under it, in the order they were opened. */
function sessionsFor(profileId: string): SessionInfo[] {
  const prefix = dbKey(profileId, "");
  const databases = Object.entries(dbStatuses)
    .filter(([key]) => key.startsWith(prefix))
    .map(([, state]) => state.session)
    .filter((session): session is SessionInfo => !!session);
  const server = statuses[profileId]?.session;
  return server ? [server, ...databases] : databases;
}

/** One Postgres database's state under a profile.
 *
 *  The database the profile itself names is already open on the server session —
 *  that session *is* this row's, and a second pool onto it would be pure waste.
 *  The rule lives here rather than at the call site because `connectDatabase`
 *  depends on the same answer to stay dedupe-correct, and a second copy of it in
 *  the tree is how the two drift apart. */
function databaseStateFor(profileId: string, database: string): ConnState {
  const server = statuses[profileId]?.session;
  if (server?.database === database) return { status: "connected", session: server };
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
  await closeServerSession(id);
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

/** Closes a backend session and drops everything cached under it. Every path
 *  that ends a session goes through here, because the schema cache is keyed by
 *  session id: a session that dies without this leaves its tree and every column
 *  it described in the store for as long as the app runs — once per database
 *  opened, now that a profile can hold many. */
async function closeSession(sessionId: string): Promise<void> {
  schema.clear(sessionId);
  await connectionsApi.disconnect(sessionId).catch(() => undefined);
}

/** Closes the profile's own session — the server's — if it holds one. */
async function closeServerSession(id: string): Promise<void> {
  const session = statuses[id]?.session;
  if (!session) return;
  if (active?.sessionId === session.sessionId) active = null;
  await closeSession(session.sessionId);
}

/** Opens a session and files it under `key` in `into`. The server session and a
 *  database session differ only in which map holds them and whether a database
 *  overrides the profile's — everything else, including the failure handling, is
 *  the same connect. Concurrent callers for one key share the one attempt. */
async function openSession(
  id: string,
  database: string | undefined,
  into: Record<string, ConnState>,
  key: string,
  label: string,
): Promise<SessionInfo | null> {
  const pending = opening.get(key);
  if (pending) return pending;
  const attempt = attemptConnect(id, database, into, key, label);
  opening.set(key, attempt);
  try {
    return await attempt;
  } finally {
    opening.delete(key);
  }
}

async function attemptConnect(
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
  const existing = databaseStateFor(profileId, database);
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
  delete dbStatuses[key];
  if (!session) return;
  // Falls back to the server session rather than nothing: it is still connected,
  // and so is every other database under it, so "Not connected" would send the
  // user hunting through the tree to get back somewhere they never left.
  if (active?.sessionId === session.sessionId) active = statuses[profileId]?.session ?? null;
  await closeSession(session.sessionId);
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
  await closeServerSession(id);
  statuses[id] = { status: "disconnected" };
}

/** Point the workspace at a session — `null` when there is nothing to point it
 *  at, which is also how a test resets the store between cases. */
function setActive(session: SessionInfo | null): void {
  active = session;
}

/** Open a profile from outside the tree (the command palette, the start pane):
 *  focus a session it already holds, otherwise connect it.
 *
 *  A Postgres profile can hold several — one per database — so an already-active
 *  one stays active and otherwise the most recently opened wins. Focusing the
 *  server session, which is what "the profile's session" used to mean, points
 *  the workspace at the maintenance database: never what the command meant, and
 *  invisible apart from the suffix in the status bar. */
async function activate(id: string): Promise<void> {
  const held = sessionsFor(id);
  if (held.length === 0) {
    await connect(id);
    return;
  }
  if (!held.some((session) => session.sessionId === active?.sessionId)) {
    setActive(held[held.length - 1]);
  }
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
  databaseStateFor,
  sessionsFor,
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
