import { randomUUID } from "node:crypto";

import { db } from "../../db.js";
import type { AiFeature, AiMode, AiSettings } from "../../types.js";

const FEATURES: AiFeature[] = ["daily_plan", "duo_reflection", "potd_tutor", "chat"];
const DEFAULT_POLICY_VERSION = "1";

export class AiConsentRequiredError extends Error {
  public constructor(duoId: string) {
    super(`Both current duo members must consent before Duo Reflection for ${duoId}.`);
    this.name = "AiConsentRequiredError";
  }

  public static assert(duoId: string): void {
    if (!hasDuoReflectionConsent(duoId)) throw new AiConsentRequiredError(duoId);
  }
}

export function setDuoConsent(userId: string, duoId: string, enabled: boolean, policyVersion: string, now: string = new Date().toISOString()): void {
  db.prepare(`INSERT INTO ai_duo_consents (duo_id, user_id, enabled, policy_version, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(duo_id, user_id) DO UPDATE SET enabled = excluded.enabled, policy_version = excluded.policy_version, updated_at = excluded.updated_at`)
    .run(duoId, userId, enabled ? 1 : 0, policyVersion, now);
}

/** Consent is valid only when exactly the currently paired members both opted in. */
export function hasDuoReflectionConsent(duoId: string): boolean {
  const members = db.prepare("SELECT id FROM users WHERE duo_id = ?").all(duoId) as Array<{ id: string }>;
  if (members.length !== 2) return false;
  const optedIn = db.prepare("SELECT user_id FROM ai_duo_consents WHERE duo_id = ? AND enabled = 1").all(duoId) as Array<{ user_id: string }>;
  return members.every((member) => optedIn.some((consent) => consent.user_id === member.id));
}

export function getAiSettings(userId: string, date: string): AiSettings {
  const preference = db.prepare("SELECT personal_enabled, duo_enabled, policy_version, mode FROM ai_preferences WHERE user_id = ?")
    .get(userId) as { personal_enabled: number; duo_enabled: number; policy_version: string; mode: AiMode } | undefined;
  const counts = db.prepare("SELECT feature, request_count FROM ai_usage_daily WHERE user_id = ? AND date = ?").all(userId, date) as Array<{ feature: AiFeature; request_count: number }>;
  const limits: Record<AiFeature, number> = { daily_plan: 3, duo_reflection: 1, potd_tutor: 5, chat: 10 };
  const usage = Object.fromEntries(FEATURES.map((feature) => {
    const used = counts.find((entry) => entry.feature === feature)?.request_count ?? 0;
    return [feature, { remaining: Math.max(0, limits[feature] - used), estimatedCostCents: 0 }];
  })) as AiSettings["usage"];
  return {
    personalEnabled: preference?.personal_enabled === 1,
    duoEnabled: preference?.duo_enabled === 1,
    policyVersion: preference?.policy_version ?? DEFAULT_POLICY_VERSION,
    mode: preference?.mode ?? "disabled",
    usage,
  };
}

export function recordAiAuditEvent(event: Omit<import("./types.js").AiAuditEvent, "createdAt">): void {
  db.prepare("INSERT INTO ai_audit_events (id, event_type, actor_user_id, duo_id, feature, policy_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(randomUUID(), event.eventType, event.actorUserId, event.duoId, event.feature, event.policyVersion, new Date().toISOString());
}

/** Deletes only data owned by the AI subsystem; application, proof, and duo data remain. */
export function deleteAiData(userId: string): void {
  db.transaction(() => {
    db.prepare("DELETE FROM ai_preferences WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM ai_duo_consents WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM ai_usage_daily WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM ai_project_usage_month WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM ai_audit_events WHERE actor_user_id = ?").run(userId);
  })();
}
