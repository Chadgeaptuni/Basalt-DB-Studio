import Feather from "@lucide/svelte/icons/feather";
import Fish from "@lucide/svelte/icons/fish";
import PostgresIcon from "$lib/components/ui/PostgresIcon.svelte";
import type { IconComponent } from "$lib/components/ui/icon";
import type { Engine } from "$lib/api/types";

/** The glyph a connection root wears, so the engine is legible without reading
 *  the tag. SQLite's own mark *is* a feather and Lucide ships one; `fish` stands
 *  in for MySQL/MariaDB's dolphin, whose real logo Oracle licenses only under a
 *  written agreement.
 *
 *  In the component layer, not beside `ENGINE_TAG` in `utils/connectionLabel.ts`,
 *  because it names components and `utils/` sits below them (DESIGN §9): from
 *  there it pulled three icon components into every consumer of the *tag*, none
 *  of which render one. The two tables still have to move together. */
export const ENGINE_ICON: Record<Engine, IconComponent> = {
  postgres: PostgresIcon,
  mysql: Fish,
  sqlite: Feather,
};
