import type { ChipTone } from "$lib/components/ui/Chip.svelte";
import type { Environment } from "$lib/api/types";

// One place decides how an environment looks and reads, so the top bar, the
// connection list and the destructive confirm can never disagree about which
// connection is production.

export const ENVIRONMENTS: Environment[] = ["local", "staging", "prod"];

const LABELS: Record<Environment, string> = {
  local: "Local",
  staging: "Staging",
  prod: "Production",
};

// Colour is a reinforcement, never the signal: the chip always carries the label
// too, so this reads the same to a colour-blind user (DESIGN §7).
const TONES: Record<Environment, ChipTone> = {
  local: "neutral",
  staging: "warn",
  prod: "error",
};

export const envLabel = (env: Environment): string => LABELS[env];
export const envTone = (env: Environment): ChipTone => TONES[env];

/** True when acting on this connection deserves an extra beat of attention. */
export const isProtected = (env: Environment | undefined): boolean => env === "prod";

/**
 * Prefix a destructive confirmation with the environment when it is one you can't
 * undo a mistake in. Untagged profiles get the plain title — inventing a warning
 * for a connection nobody classified would train people to click through it.
 */
export function envConfirmTitle(title: string, env: Environment | undefined): string {
  return isProtected(env) ? `${LABELS.prod}: ${title}` : title;
}
