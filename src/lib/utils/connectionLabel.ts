import type { ConnectionProfile, Engine } from "$lib/api/types";

// How a connection profile names itself, declared once: the status bar, the
// schema tree's roots and the command palette all print the same strings. Data
// only — the engine *glyph* is `ENGINE_ICON` in
// components/connections/engineIcon.ts, because it names components and this
// module sits below them (DESIGN §9).

export const ENGINE_TAG: Record<Engine, string> = { postgres: "PG", mysql: "MY", sqlite: "SQ" };

/** Where the server lives — `host:port`. Empty for SQLite, which has none. */
export function connectionServer(profile: ConnectionProfile): string {
  if (profile.engine === "sqlite") return "";
  return `${profile.host ?? ""}${profile.port ? `:${profile.port}` : ""}`;
}

/** Where the profile points — a file for SQLite, `host:port/database` otherwise. */
export function connectionTarget(profile: ConnectionProfile): string {
  if (profile.engine === "sqlite") return profile.filePath ?? "";
  return `${connectionServer(profile)}${profile.database ? `/${profile.database}` : ""}`;
}
