import type { ConnectionProfile, Engine } from "$lib/api/types";

// How a connection profile names itself, declared once: the status bar, the
// schema tree's roots and the command palette all print the same two strings.

export const ENGINE_TAG: Record<Engine, string> = { postgres: "PG", mysql: "MY", sqlite: "SQ" };

/** Where the profile points — a file for SQLite, `host:port/database` otherwise. */
export function connectionTarget(profile: ConnectionProfile): string {
  if (profile.engine === "sqlite") return profile.filePath ?? "";
  const port = profile.port ? `:${profile.port}` : "";
  const database = profile.database ? `/${profile.database}` : "";
  return `${profile.host ?? ""}${port}${database}`;
}
