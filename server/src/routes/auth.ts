import { Hono, type Context } from "hono";
import { db } from "../db.js";
import { newId } from "../lib/ids.js";
import { sessionAuth } from "../lib/authMiddleware.js";
import type { AppEnv } from "../honoEnv.js";
import { DEFAULT_USER_CONFIG, type DuoRow, type UserRow } from "../types.js";

export const authRoutes = new Hono<AppEnv>();

function publicUser(user: UserRow) {
  return { id: user.id, name: user.name, duoId: user.duo_id };
}

export function findDuoWithMembers(duoId: string): { id: string; name: string; inviteCode: string; members: { id: string; name: string }[] } | null {
  const duo = db.prepare<[string], DuoRow>(`SELECT * FROM duos WHERE id = ?`).get(duoId);
  if (!duo) return null;
  const members = db
    .prepare<[string], { id: string; name: string }>(`SELECT id, name FROM users WHERE duo_id = ?`)
    .all(duoId);
  return { id: duo.id, name: duo.name, inviteCode: duo.invite_code, members };
}

async function readName(c: Context<AppEnv>): Promise<string> {
  const body = await c.req.json().catch(() => null);
  const name = body && typeof body === "object" && "name" in body ? (body as { name: unknown }).name : undefined;
  return typeof name === "string" ? name.trim() : "";
}

/** Register — or, if the name already exists, log that user back in with a fresh token. */
authRoutes.post("/register", async (c) => {
  const name = await readName(c);
  if (!name) return c.json({ error: "name is required" }, 400);

  const existing = db.prepare<[string], UserRow>(`SELECT * FROM users WHERE name = ?`).get(name);
  const token = newId("sess");

  if (existing) {
    db.prepare(`UPDATE users SET session_token = ? WHERE id = ?`).run(token, existing.id);
    return c.json({ token, user: publicUser({ ...existing, session_token: token }) });
  }

  const id = newId("usr");
  db.prepare(
    `INSERT INTO users (id, name, duo_id, session_token, config_json, created_at) VALUES (?, ?, NULL, ?, ?, ?)`,
  ).run(id, name, token, JSON.stringify(DEFAULT_USER_CONFIG), new Date().toISOString());

  return c.json({ token, user: { id, name, duoId: null } });
});

authRoutes.post("/login", async (c) => {
  const name = await readName(c);
  if (!name) return c.json({ error: "name is required" }, 400);

  const existing = db.prepare<[string], UserRow>(`SELECT * FROM users WHERE name = ?`).get(name);
  if (!existing) return c.json({ error: "no user with that name — register first" }, 404);

  const token = newId("sess");
  db.prepare(`UPDATE users SET session_token = ? WHERE id = ?`).run(token, existing.id);
  return c.json({ token, user: publicUser({ ...existing, session_token: token }) });
});

authRoutes.get("/me", sessionAuth, (c) => {
  const user = c.get("user");
  const duo = user.duo_id ? findDuoWithMembers(user.duo_id) : null;
  return c.json({ user: publicUser(user), duo });
});
