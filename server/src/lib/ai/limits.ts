import { db } from "../../db.js";
import type { AiFeature } from "../../types.js";
import { today } from "../dates.js";
import { quotaSubject } from "../quotaIdentity.js";
import { getAiRuntimeConfig, type AiRuntimeConfig } from "./config.js";
import { recordAiAuditEvent } from "./policy.js";
import { pruneExpiredQuotaRows } from "./quotaRetention.js";

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
export function reserveAiRequest(request: ReserveAiRequest, config: AiRuntimeConfig = getAiRuntimeConfig()): AiReservation {
  if (!Number.isInteger(request.estimatedCostCents) || request.estimatedCostCents < 0) throw new RangeError("estimatedCostCents must be a non-negative integer.");
  const effectiveDate = today();
  if (request.date !== undefined && request.date !== effectiveDate) throw new RangeError("AI requests must use the server's current date.");
  const month = effectiveDate.slice(0, 7);
  const subjectHash = quotaSubject(request.actorUserId);
  const duoHash = request.duoId ? quotaSubject(request.duoId) : null;
  const reserve = db.transaction(() => {
    pruneExpiredQuotaRows(effectiveDate);
    const userCost = (db.prepare("SELECT COALESCE(SUM(reserved_cost_cents), 0) AS total FROM ai_quota_daily WHERE subject_hash = ? AND date = ?").get(subjectHash, effectiveDate) as { total: number }).total;
    if (userCost + request.estimatedCostCents > config.userDailyBudgetCents) throw new AiLimitError("user_budget");
    const projectCost = (db.prepare("SELECT COALESCE(reserved_cost_cents, 0) AS total FROM ai_project_quota_month WHERE month = ?").get(month) as { total: number | null } | undefined)?.total ?? 0;
    if (projectCost + request.estimatedCostCents > config.projectMonthlyBudgetCents) throw new AiLimitError("project_budget");
    if (request.feature === "duo_reflection") {
      if (!request.duoId) throw new AiLimitError("feature");
      const used = (db.prepare("SELECT COALESCE(SUM(request_count), 0) AS total FROM ai_quota_daily WHERE duo_hash = ? AND feature = ? AND date BETWEEN ? AND ?").get(duoHash, request.feature, weekStart(effectiveDate), weekEnd(effectiveDate)) as { total: number }).total;
      if (used >= config.reflectionsPerDuoPerWeek) throw new AiLimitError("feature");
    } else {
      const used = (db.prepare("SELECT request_count FROM ai_quota_daily WHERE subject_hash = ? AND feature = ? AND date = ?").get(subjectHash, request.feature, effectiveDate) as { request_count: number } | undefined)?.request_count ?? 0;
      if (used >= featureCallLimit(request.feature, config)) throw new AiLimitError("feature");
    }
    db.prepare(`INSERT INTO ai_quota_daily (subject_hash, duo_hash, feature, date, request_count, reserved_cost_cents) VALUES (?, ?, ?, ?, 1, ?)
      ON CONFLICT(subject_hash, feature, date) DO UPDATE SET request_count = request_count + 1, reserved_cost_cents = reserved_cost_cents + excluded.reserved_cost_cents, duo_hash = excluded.duo_hash`)
      .run(subjectHash, duoHash, request.feature, effectiveDate, request.estimatedCostCents);
    db.prepare(`INSERT INTO ai_project_quota_month (month, reserved_cost_cents) VALUES (?, ?)
      ON CONFLICT(month) DO UPDATE SET reserved_cost_cents = reserved_cost_cents + excluded.reserved_cost_cents`)
      .run(month, request.estimatedCostCents);
    recordAiAuditEvent({ eventType: "reserved", actorUserId: request.actorUserId, duoId: request.duoId ?? null, feature: request.feature, policyVersion: request.policyVersion });
  });
  reserve();
  let active = true;
  return {
    rollback(): void {
      if (!active) return;
      db.transaction(() => {
        db.prepare("UPDATE ai_quota_daily SET request_count = request_count - 1, reserved_cost_cents = reserved_cost_cents - ? WHERE subject_hash = ? AND feature = ? AND date = ?").run(request.estimatedCostCents, subjectHash, request.feature, effectiveDate);
        db.prepare("DELETE FROM ai_quota_daily WHERE subject_hash = ? AND feature = ? AND date = ? AND request_count = 0").run(subjectHash, request.feature, effectiveDate);
        db.prepare("UPDATE ai_project_quota_month SET reserved_cost_cents = reserved_cost_cents - ? WHERE month = ?").run(request.estimatedCostCents, month);
        db.prepare("DELETE FROM ai_project_quota_month WHERE month = ? AND reserved_cost_cents = 0").run(month);
        recordAiAuditEvent({ eventType: "rolled_back", actorUserId: request.actorUserId, duoId: request.duoId ?? null, feature: request.feature, policyVersion: request.policyVersion });
      })();
      active = false;
    },
  };
}

function featureCallLimit(feature: Exclude<AiFeature, "duo_reflection">, config: AiRuntimeConfig): number {
  switch (feature) {
    case "daily_plan": return config.dailyCallsPerUser;
    case "insights_explain": return config.dailyCallsPerUser;
    case "potd_tutor": return config.tutorCallsPerUser;
    case "chat": return config.chatCallsPerUser;
  }
}
