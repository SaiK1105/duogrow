import { Hono } from "hono";
import { db } from "../db.js";
import { sessionAuth } from "../lib/authMiddleware.js";
import { buildAnalyticsSummary, parseAnalyticsRange, ANALYTICS_RANGES } from "../lib/analytics.js";
import type { AppEnv } from "../honoEnv.js";
import type { ProofRow, UserRow } from "../types.js";

export const analyticsRoutes = new Hono<AppEnv>();
analyticsRoutes.use("*", sessionAuth);

const PROOF_STATUSES = new Set(["pending", "verified", "review", "rejected", "error"]);
const PROOF_MODULES = new Set(["wake", "study", "workout", "diet", "tasks"]);
const DEFAULT_PROOF_LIMIT = 25;
const MAX_PROOF_LIMIT = 100;

analyticsRoutes.get("/summary", (c) => {
  const user = c.get("user");
  if (!user.duo_id) return c.json({ error: "join a duo to see analytics" }, 409);

  const range = parseAnalyticsRange(c.req.query("days"));
  if (range === null) {
    return c.json({ error: `days must be one of ${ANALYTICS_RANGES.join(", ")}` }, 400);
  }

  const members = db
    .prepare<[string], UserRow>(`SELECT * FROM users WHERE duo_id = ? ORDER BY created_at`)
    .all(user.duo_id);

  return c.json(buildAnalyticsSummary(user.duo_id, members, range));
});

/**
 * Proof history with filtering. The phone's GET /api/proofs deliberately returns
 * a fixed 12 most-recent rows; a history view needs to page and filter, so this
 * is a separate endpoint rather than an overload of that contract.
 */
analyticsRoutes.get("/proofs", (c) => {
  const user = c.get("user");
  if (!user.duo_id) return c.json({ error: "join a duo to see analytics" }, 409);

  const module = c.req.query("module");
  if (module !== undefined && !PROOF_MODULES.has(module)) {
    return c.json({ error: "unknown module filter" }, 400);
  }

  const status = c.req.query("status");
  if (status !== undefined && !PROOF_STATUSES.has(status)) {
    return c.json({ error: "unknown status filter" }, 400);
  }

  const limit = parseLimit(c.req.query("limit"));
  if (limit === null) return c.json({ error: `limit must be between 1 and ${MAX_PROOF_LIMIT}` }, 400);

  // The cursor is (created_at, id) rather than created_at alone: proofs created
  // inside the same clock tick would otherwise straddle a page boundary and
  // either repeat or vanish.
  const cursor = parseCursor(c.req.query("cursor"));
  if (cursor === null) return c.json({ error: "malformed cursor" }, 400);

  const filters: string[] = [`duo_id = ?`];
  const params: string[] = [user.duo_id];
  if (module !== undefined) {
    filters.push(`target_module = ?`);
    params.push(module);
  }
  if (status !== undefined) {
    filters.push(`ai_status = ?`);
    params.push(status);
  }
  if (cursor !== undefined) {
    filters.push(`(created_at < ? OR (created_at = ? AND id < ?))`);
    params.push(cursor.createdAt, cursor.createdAt, cursor.id);
  }

  // Fetch one extra row to learn whether another page exists without a count query.
  const rows = db
    .prepare<string[], ProofRow>(
      `SELECT * FROM proofs WHERE ${filters.join(" AND ")} ORDER BY created_at DESC, id DESC LIMIT ?`,
    )
    .all(...params, String(limit + 1));

  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return c.json({
    proofs: page.map(publicProof),
    nextCursor: rows.length > limit && last ? `${last.created_at}|${last.id}` : null,
  });
});

function parseLimit(raw: string | undefined): number | null {
  if (raw === undefined) return DEFAULT_PROOF_LIMIT;
  if (!/^[1-9]\d*$/.test(raw)) return null;
  const parsed = Number(raw);
  return parsed <= MAX_PROOF_LIMIT ? parsed : null;
}

function parseCursor(raw: string | undefined): { createdAt: string; id: string } | undefined | null {
  if (raw === undefined) return undefined;
  const separator = raw.indexOf("|");
  if (separator <= 0 || separator === raw.length - 1) return null;
  return { createdAt: raw.slice(0, separator), id: raw.slice(separator + 1) };
}

/** Never expose file_path — proof bytes are only reachable through the authorized file route. */
function publicProof(proof: ProofRow) {
  return {
    id: proof.id,
    userId: proof.user_id,
    date: proof.date,
    module: proof.target_module,
    status: proof.ai_status,
    confidence: proof.ai_confidence,
    band: proof.ai_band,
    summary: proof.ai_summary,
    createdAt: proof.created_at,
  };
}
