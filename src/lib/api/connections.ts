import { invoke } from "./client";
import type { ConnectionProfile, SessionInfo } from "./types";

// Typed wrappers over the connection commands. The ONLY invoke site for this
// domain (DESIGN §9). Arg keys are camelCase; Tauri maps them to snake_case.
export const connectionsApi = {
  list: () => invoke<ConnectionProfile[]>("list_connections"),
  save: (profile: ConnectionProfile) => invoke<void>("save_connection", { profile }),
  remove: (id: string) => invoke<void>("delete_connection", { id }),
  test: (profile: ConnectionProfile) => invoke<void>("test_connection", { profile }),
  connect: (profileId: string) => invoke<SessionInfo>("connect", { profileId }),
  disconnect: (sessionId: string) => invoke<void>("disconnect", { sessionId }),
};
