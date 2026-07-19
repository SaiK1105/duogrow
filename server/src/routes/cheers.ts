import { Hono } from "hono";
import { db } from "../db.js";
import { newId } from "../lib/ids.js";
import { sessionAuth } from "../lib/authMiddleware.js";
import type { AppEnv } from "../honoEnv.js";
import type { CheerRow, UserRow } from "../types.js";

export const cheerRoutes = new Hono<AppEnv>();
cheerRoutes.use("*", sessionAuth);

cheerRoutes.post("/", async (c) => {
  const user = c.get("user");
  if (!user.duo_id) return c.json({ error: "join a duo first" }, 409);

  const partner = db
    .prepare<[string, string], UserRow>(`SELECT * FROM users WHERE duo_id = ? AND id != ?`)
    .get(user.duo_id, user.id);
  if (!partner) return c.json({ error: "no partner to cheer yet" }, 409);

  const body = await c.req.json().catch(() => ({}) as Record<string, unknown>);
  const emoji = typeof body.emoji === "string" && body.emoji.length > 0 ? body.emoji : null;
  if (!emoji) return c.json({ error: "emoji is required" }, 400);
  const message = typeof body.message === "string" && body.message.length > 0 ? body.message : null;

  db.prepare(
    `INSERT INTO cheers (id, duo_id, from_user_id, to_user_id, message, emoji, seen, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
  ).run(newId("cheer"), user.duo_id, user.id, partner.id, message, emoji, new Date().toISOString());

  return c.json({ ok: true });
});

cheerRoutes.post("/:id/seen", (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const cheer = db.prepare<[string], CheerRow>(`SELECT * FROM cheers WHERE id = ?`).get(id);
  if (!cheer || cheer.to_user_id !== user.id) return c.json({ error: "cheer not found" }, 404);

  db.prepare(`UPDATE cheers SET seen = 1 WHERE id = ?`).run(id);
  return c.json({ ok: true });
});
