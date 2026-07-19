import type { Context, Next } from "hono";
import { db } from "../db.js";
import type { AppEnv } from "../honoEnv.js";
import type { UserRow } from "../types.js";

/** Requires a valid `x-session` header, looked up against users.session_token. */
export async function sessionAuth(c: Context<AppEnv>, next: Next): Promise<Response | void> {
  const token = c.req.header("x-session");
  if (!token) return c.json({ error: "unauthorized" }, 401);

  const user = db.prepare<[string], UserRow>(`SELECT * FROM users WHERE session_token = ?`).get(token);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  c.set("user", user);
  await next();
}
