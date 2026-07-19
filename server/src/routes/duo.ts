import { Hono } from "hono";
import { db } from "../db.js";
import { newId, newInviteCode } from "../lib/ids.js";
import { sessionAuth } from "../lib/authMiddleware.js";
import { findDuoWithMembers } from "./auth.js";
import type { AppEnv } from "../honoEnv.js";
import type { DuoRow } from "../types.js";

export const duoRoutes = new Hono<AppEnv>();
duoRoutes.use("*", sessionAuth);

function uniqueInviteCode(): string {
  let code = newInviteCode();
  while (db.prepare(`SELECT 1 FROM duos WHERE invite_code = ?`).get(code)) {
    code = newInviteCode();
  }
  return code;
}

duoRoutes.post("/", (c) => {
  const user = c.get("user");
  if (user.duo_id) return c.json({ error: "already in a duo" }, 409);

  const id = newId("duo");
  const inviteCode = uniqueInviteCode();

  db.prepare(
    `INSERT INTO duos (id, name, invite_code, potd_mode, created_by, created_at) VALUES (?, ?, ?, 'same', ?, ?)`,
  ).run(id, `${user.name}'s Duo`, inviteCode, user.id, new Date().toISOString());
  db.prepare(`UPDATE users SET duo_id = ? WHERE id = ?`).run(id, user.id);

  return c.json({ duo: findDuoWithMembers(id) });
});

duoRoutes.post("/join", async (c) => {
  const user = c.get("user");
  if (user.duo_id) return c.json({ error: "already in a duo" }, 409);

  const body = await c.req.json().catch(() => null);
  const raw = body && typeof body === "object" && "inviteCode" in body ? (body as { inviteCode: unknown }).inviteCode : undefined;
  const inviteCode = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  if (!inviteCode) return c.json({ error: "inviteCode is required" }, 400);

  const duo = db.prepare<[string], DuoRow>(`SELECT * FROM duos WHERE invite_code = ?`).get(inviteCode);
  if (!duo) return c.json({ error: "invite code not found" }, 404);

  const memberCount = db
    .prepare<[string], { count: number }>(`SELECT COUNT(*) as count FROM users WHERE duo_id = ?`)
    .get(duo.id)!.count;
  if (memberCount >= 2) return c.json({ error: "duo is already full" }, 409);

  db.prepare(`UPDATE users SET duo_id = ? WHERE id = ?`).run(duo.id, user.id);
  return c.json({ duo: findDuoWithMembers(duo.id) });
});

duoRoutes.get("/", (c) => {
  const user = c.get("user");
  return c.json({ duo: user.duo_id ? findDuoWithMembers(user.duo_id) : null });
});
