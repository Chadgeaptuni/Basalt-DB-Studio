import Feather from "@lucide/svelte/icons/feather";
import Fish from "@lucide/svelte/icons/fish";
import PostgresIcon from "$lib/components/ui/PostgresIcon.svelte";
import type { IconComponent } from "$lib/components/ui/icon";
import type { ConnectionProfile, Engine } from "$lib/api/types";

// How a connection profile names itself, declared once: the status bar, the
// schema tree's roots and the command palette all print the same two strings.

export const ENGINE_TAG: Record<Engine, string> = { postgres: "PG", mysql: "MY", sqlite: "SQ" };

/** The glyph a connection root wears, so the engine is legible without reading
 *  the tag. SQLite's own mark *is* a feather and Lucide ships one; `fish` stands
 *  in for MySQL/MariaDB's dolphin, whose real logo Oracle licenses only under a
 *  written agreement. Engine presentation lives together here — a second table
 *  somewhere else is how the tag and the glyph drift apart. */
export const ENGINE_ICON: Record<Engine, IconComponent> = {
  postgres: PostgresIcon,
  mysql: Fish,
  sqlite: Feather,
};

/** Where the profile points — a file for SQLite, `host:port/database` otherwise. */
export function connectionTarget(profile: ConnectionProfile): string {
  if (profile.engine === "sqlite") return profile.filePath ?? "";
  const port = profile.port ? `:${profile.port}` : "";
  const database = profile.database ? `/${profile.database}` : "";
  return `${profile.host ?? ""}${port}${database}`;
}
