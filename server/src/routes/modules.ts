import { Hono } from "hono";
import { db } from "../db.js";
import { newId } from "../lib/ids.js";
import { sessionAuth } from "../lib/authMiddleware.js";
import { defaultTarget } from "../lib/snapshot.js";
import { today } from "../lib/dates.js";
import type { AppEnv } from "../honoEnv.js";
import { MODULE_NAMES, parseUserConfig, type DailyEntryRow, type ModuleName } from "../types.js";

export const moduleRoutes = new Hono<AppEnv>();
moduleRoutes.use("*", sessionAuth);

function isModuleName(value: string): value is ModuleName {
  return (MODULE_NAMES as string[]).includes(value);
}

moduleRoutes.put("/:module", async (c) => {
  const user = c.get("user");
  if (!user.duo_id) return c.json({ error: "join a duo first" }, 409);

  const moduleParam = c.req.param("module");
  if (!isModuleName(moduleParam)) return c.json({ error: "unknown module" }, 400);

  const body = await c.req.json().catch(() => ({}) as Record<string, unknown>);
  const status = body.status === "done" || body.status === "pending" ? body.status : undefined;
  const value = typeof body.value === "number" ? body.value : undefined;
  const hasDetail = Object.prototype.hasOwnProperty.call(body, "detail");

  const date = today();
  const config = parseUserConfig(user.config_json);
  const existing = db
    .prepare<[string, string, string], DailyEntryRow>(
      `SELECT * FROM daily_entries WHERE user_id = ? AND date = ? AND module = ?`,
    )
    .get(user.id, date, moduleParam);

  const nextStatus = status ?? existing?.status ?? "pending";
  const nextValue = value ?? existing?.value ?? null;
  const nextTarget = existing?.target ?? defaultTarget(moduleParam, config);
  const nextDetail = hasDetail ? JSON.stringify(body.detail) : (existing?.detail_json ?? null);
  const now = new Date().toISOString();

  if (existing) {
    db.prepare(`UPDATE daily_entries SET status = ?, value = ?, target = ?, detail_json = ?, updated_at = ? WHERE id = ?`).run(
      nextStatus,
      nextValue,
      nextTarget,
      nextDetail,
      now,
      existing.id,
    );
  } else {
    db.prepare(
      `INSERT INTO daily_entries (id, user_id, duo_id, date, module, status, value, target, detail_json, proof_id, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
    ).run(newId("entry"), user.id, user.duo_id, date, moduleParam, nextStatus, nextValue, nextTarget, nextDetail, now);
  }

  const entryRow = db
    .prepare<[string, string, string], DailyEntryRow>(
      `SELECT * FROM daily_entries WHERE user_id = ? AND date = ? AND module = ?`,
    )
    .get(user.id, date, moduleParam)!;

  return c.json({
    ok: true,
    entry: {
      module: entryRow.module,
      status: entryRow.status,
      value: entryRow.value,
      target: entryRow.target,
      detail: entryRow.detail_json ? JSON.parse(entryRow.detail_json) : null,
      updatedAt: entryRow.updated_at,
    },
  });
});
