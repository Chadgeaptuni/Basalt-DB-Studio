import type { ConnectionProfile } from "$lib/api/types";
import { connections, type ConnStatus } from "$lib/stores/connections.svelte";
import { schema } from "$lib/stores/schema.svelte";

// What the object explorer's components agree on. Two of them draw the same node
// at different depths (SessionNode.svelte); this is the rest of the agreement —
// the tone scale, the indent, and what Refresh means at each level.

/** Colour is a reinforcement here, not the signal: the row also carries its
 *  state in the branch beneath it (spinner, error, schema) (DESIGN §7). */
export const ICON_TONE: Record<ConnStatus, string> = {
  connected: "text-ok",
  connecting: "text-warn",
  error: "text-error",
  disconnected: "text-on-surface-muted",
};

/** Left padding for a row in the branch *under* a tree item at `depth` — a
 *  status line, a column. `depth * 12` is TreeItem's own step; the 20 lands the
 *  text under the label rather than under the chevron. */
export function branchIndent(depth: number): number {
  return depth * 12 + 20;
}

/** Whether a connection draws a database level between its root and its
 *  namespaces. Postgres does, because a pg session can never leave the database
 *  it opened; MySQL already sees every database on the server as a namespace of
 *  one connection, and a SQLite file *is* the database. */
export function hasDatabaseLevel(profile: ConnectionProfile): boolean {
  return profile.engine === "postgres";
}

/** Refresh what one session shows. Deliberately not `schema.clear`: on a
 *  Postgres server session that would also drop the database list this row's own
 *  siblings are drawn from, unmounting the branch and every sibling's expansion
 *  state with it. */
export function refreshSession(sessionId: string): void {
  schema.clearTree(sessionId);
}

/** Refresh a connection root: its database list *and* every database already
 *  open under it. Clearing the server session's cache alone re-listed the
 *  databases — so the branch flickered as though the refresh had worked — while
 *  every open database below it kept its stale tree. */
export function refreshProfile(profile: ConnectionProfile): void {
  for (const session of connections.sessionsFor(profile.id)) schema.clearTree(session.sessionId);
  const server = connections.statusFor(profile.id).session;
  if (server) schema.clearDatabases(server.sessionId);
}
