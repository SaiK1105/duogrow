import { db } from "../../db.js";
import type { AiFeature } from "../../types.js";
import { today } from "../dates.js";
import { recordAiAuditEvent } from "./policy.js";

export const AI_USER_DAILY_BUDGET_CENTS = 3;
export const AI_PROJECT_MONTHLY_BUDGET_CENTS = 2500;

const DAILY_LIMITS: Record<Exclude<AiFeature, "duo_reflection">, number> = { daily_plan: 3, potd_tutor: 5, chat: 10 };

export class AiLimitError extends Error {
  public constructor(public readonly limit: "feature" | "user_budget" | "project_budget") {
    super(`AI ${limit} limit reached.`);
    this.name = "AiLimitError";
  }
}

export interface ReserveAiRequest {
  actorUserId: string;
  duoId?: string;
  feature: AiFeature;
  /** Must be the server's current day. Kept only to reject stale or forged callers. */
  date?: string;
  estimatedCostCents: number;
  policyVersion: string;
}

export interface AiReservation {
  rollback(): void;
}

function weekStart(date: string): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  const day = (value.getUTCDay() + 6) % 7;
  value.setUTCDate(value.getUTCDate() - day);
  return value.toISOString().slice(0, 10);
}

function weekEnd(date: string): string {
  const value = new Date(`${weekStart(date)}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + 6);
  return value.toISOString().slice(0, 10);
}

/** Atomically reserves both the per-user and project budget until a provider succeeds or rolls back. */
export function reserveAiRequest(request: ReserveAiRequest): AiReservation {
  if (!Number.isInteger(request.estimatedCostCents) || request.estimatedCostCents < 0) throw new RangeError("estimatedCostCents must be a non-negative integer.");
  const effectiveDate = today();
  if (request.date !== undefined && request.date !== effectiveDate) throw new RangeError("AI requests must use the server's current date.");
  const month = effectiveDate.slice(0, 7);
  const reserve = db.transaction(() => {
    const userCost = (db.prepare("SELECT COALESCE(SUM(reserved_cost_cents), 0) AS total FROM ai_usage_daily WHERE user_id = ? AND date = ?").get(request.actorUserId, effectiveDate) as { total: number }).total;
    if (userCost + request.estimatedCostCents > AI_USER_DAILY_BUDGET_CENTS) throw new AiLimitError("user_budget");
    const projectCost = (db.prepare("SELECT COALESCE(SUM(reserved_cost_cents), 0) AS total FROM ai_project_usage_month WHERE month = ?").get(month) as { total: number }).total;
    if (projectCost + request.estimatedCostCents > AI_PROJECT_MONTHLY_BUDGET_CENTS) throw new AiLimitError("project_budget");
    if (request.feature === "duo_reflection") {
      if (!request.duoId) throw new AiLimitError("feature");
      const used = (db.prepare("SELECT COALESCE(SUM(request_count), 0) AS total FROM ai_usage_daily WHERE duo_id = ? AND feature = ? AND date BETWEEN ? AND ?").get(request.duoId, request.feature, weekStart(effectiveDate), weekEnd(effectiveDate)) as { total: number }).total;
      if (used >= 1) throw new AiLimitError("feature");
    } else {
      const used = (db.prepare("SELECT request_count FROM ai_usage_daily WHERE user_id = ? AND feature = ? AND date = ?").get(request.actorUserId, request.feature, effectiveDate) as { request_count: number } | undefined)?.request_count ?? 0;
      if (used >= DAILY_LIMITS[request.feature]) throw new AiLimitError("feature");
    }
    db.prepare(`INSERT INTO ai_usage_daily (user_id, duo_id, feature, date, request_count, reserved_cost_cents) VALUES (?, ?, ?, ?, 1, ?)
      ON CONFLICT(user_id, feature, date) DO UPDATE SET request_count = request_count + 1, reserved_cost_cents = reserved_cost_cents + excluded.reserved_cost_cents, duo_id = excluded.duo_id`)
      .run(request.actorUserId, request.duoId ?? null, request.feature, effectiveDate, request.estimatedCostCents);
    db.prepare(`INSERT INTO ai_project_usage_month (user_id, month, reserved_cost_cents) VALUES (?, ?, ?)
      ON CONFLICT(user_id, month) DO UPDATE SET reserved_cost_cents = reserved_cost_cents + excluded.reserved_cost_cents`)
      .run(request.actorUserId, month, request.estimatedCostCents);
    recordAiAuditEvent({ eventType: "reserved", actorUserId: request.actorUserId, duoId: request.duoId ?? null, feature: request.feature, policyVersion: request.policyVersion });
  });
  reserve();
  let active = true;
  return {
    rollback(): void {
      if (!active) return;
      db.transaction(() => {
        db.prepare("UPDATE ai_usage_daily SET request_count = request_count - 1, reserved_cost_cents = reserved_cost_cents - ? WHERE user_id = ? AND feature = ? AND date = ?").run(request.estimatedCostCents, request.actorUserId, request.feature, effectiveDate);
        db.prepare("DELETE FROM ai_usage_daily WHERE user_id = ? AND feature = ? AND date = ? AND request_count = 0").run(request.actorUserId, request.feature, effectiveDate);
        db.prepare("UPDATE ai_project_usage_month SET reserved_cost_cents = reserved_cost_cents - ? WHERE user_id = ? AND month = ?").run(request.estimatedCostCents, request.actorUserId, month);
        db.prepare("DELETE FROM ai_project_usage_month WHERE user_id = ? AND month = ? AND reserved_cost_cents = 0").run(request.actorUserId, month);
        recordAiAuditEvent({ eventType: "rolled_back", actorUserId: request.actorUserId, duoId: request.duoId ?? null, feature: request.feature, policyVersion: request.policyVersion });
      })();
      active = false;
    },
  };
}
