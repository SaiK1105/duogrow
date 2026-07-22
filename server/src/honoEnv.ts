import type { UserRow } from "./types.js";

/** Shared application context used by every authenticated API route. */
/** Typed Hono context variables — set by the session-auth middleware. */
export interface AppEnv {
  Variables: {
    user: UserRow;
  };
}
