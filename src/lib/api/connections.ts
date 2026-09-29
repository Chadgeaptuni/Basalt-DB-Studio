import { invoke } from "./client";
import type { ConnectionProfile, Secret, SessionInfo } from "./types";

// Typed wrappers over the connection commands. The ONLY invoke site for this
// domain (DESIGN §9). Arg keys are camelCase; Tauri maps them to snake_case.
// The profile has no password field by construction: a password rides as a
// transient arg on connect/test (unset → the backend reads the keychain), and
// `save` puts it in the OS keychain only when `remember` is set.
export const connectionsApi = {
  list: () => invoke<ConnectionProfile[]>("list_connections"),
  save: (profile: ConnectionProfile, secret: Secret, remember: boolean) =>
    invoke<void>("save_connection", { profile, secret, remember }),
  remove: (id: string) => invoke<void>("delete_connection", { id }),
  test: (profile: ConnectionProfile, password?: string) =>
    invoke<void>("test_connection", { profile, password }),
  // `database` overrides the profile's — a Postgres database node opening its
  // own session, since a pg connection can never leave the database it opened.
  connect: (profileId: string, password?: string, database?: string) =>
    invoke<SessionInfo>("connect", { profileId, password, database }),
  disconnect: (sessionId: string) => invoke<void>("disconnect", { sessionId }),
};
