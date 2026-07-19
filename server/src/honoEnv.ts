import type { UserRow } from "./types.js";

/** Typed Hono context variables — set by the session-auth middleware. */
export interface AppEnv {
  Variables: {
    user: UserRow;
  };
}
