import { randomUUID } from "node:crypto";

import { db } from "../../db.js";
import type { AiFeature, AiMode, AiSettings } from "../../types.js";
import { quotaSubject } from "../quotaIdentity.js";
import { today } from "../dates.js";
import { getAiRuntimeConfig, getCoachingMode, type CoachingMode, type AiRuntimeConfig } from "./config.js";
import { pruneExpiredQuota } from "./quotaRetention.js";

const FEATURES: AiFeature[] = ["daily_plan", "duo_reflection", "potd_tutor", "chat", "insights_explain"];
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

export interface AiPreferenceUpdate {
  userId: string;
  duoId: string | null;
  personalEnabled: boolean;
  duoEnabled: boolean;
  policyVersion: string;
}

/** Saves personal preferences and the member's effective duo consent in one SQLite transaction. */
export function updateAiPreferences(update: AiPreferenceUpdate): void {
  db.transaction(() => {
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO ai_preferences (user_id, personal_enabled, duo_enabled, policy_version, mode, updated_at) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET personal_enabled = excluded.personal_enabled, duo_enabled = excluded.duo_enabled, policy_version = excluded.policy_version, mode = excluded.mode, updated_at = excluded.updated_at`)
      .run(update.userId, update.personalEnabled ? 1 : 0, update.duoEnabled ? 1 : 0, update.policyVersion, update.personalEnabled ? getCoachingMode() : "disabled", now);
    if (update.duoId) {
      setDuoConsent(update.userId, update.duoId, update.personalEnabled && update.duoEnabled, update.policyVersion, now);
      recordAiAuditEvent({ eventType: "duo_consent_changed", actorUserId: update.userId, duoId: update.duoId, feature: "duo_reflection", policyVersion: update.policyVersion });
    }
    recordAiAuditEvent({ eventType: "preferences_updated", actorUserId: update.userId, duoId: update.duoId, feature: "daily_plan", policyVersion: update.policyVersion });
  })();
}

/** Consent is valid only when exactly the currently paired members both opted in. */
export function hasDuoReflectionConsent(duoId: string): boolean {
  const members = db.prepare("SELECT id FROM users WHERE duo_id = ?").all(duoId) as Array<{ id: string }>;
  if (members.length !== 2) return false;
  const optedIn = db.prepare(`SELECT consent.user_id
    FROM ai_duo_consents consent
    JOIN ai_preferences preference ON preference.user_id = consent.user_id
    WHERE consent.duo_id = ? AND consent.enabled = 1 AND preference.personal_enabled = 1 AND preference.duo_enabled = 1`)
    .all(duoId) as Array<{ user_id: string }>;
  return members.every((member) => optedIn.some((consent) => consent.user_id === member.id));
}

export function getAiSettings(userId: string, date: string, config: AiRuntimeConfig = getAiRuntimeConfig(), coachingMode: CoachingMode = getCoachingMode()): AiSettings {
  if (date === today()) pruneExpiredQuota(date);
  const preference = db.prepare("SELECT personal_enabled, duo_enabled, policy_version, mode FROM ai_preferences WHERE user_id = ?")
    .get(userId) as { personal_enabled: number; duo_enabled: number; policy_version: string; mode: AiMode } | undefined;
  const counts = db.prepare("SELECT feature, request_count FROM ai_quota_daily WHERE subject_hash = ? AND date = ?").all(quotaSubject(userId), date) as Array<{ feature: AiFeature; request_count: number }>;
  const duoId = (db.prepare("SELECT duo_id FROM users WHERE id = ?").get(userId) as { duo_id: string | null } | undefined)?.duo_id;
  const reflectionUsage = duoId
    ? (db.prepare("SELECT COALESCE(SUM(request_count), 0) AS total FROM ai_quota_daily WHERE duo_hash = ? AND feature = ? AND date BETWEEN ? AND ?")
      .get(quotaSubject(duoId), "duo_reflection", weekStart(date), weekEnd(date)) as { total: number }).total
    : 0;
  const limits: Record<AiFeature, number> = {
    daily_plan: config.dailyCallsPerUser,
    duo_reflection: config.reflectionsPerDuoPerWeek,
    potd_tutor: config.tutorCallsPerUser,
    chat: config.chatCallsPerUser,
    insights_explain: config.dailyCallsPerUser,
  };
  const usage = Object.fromEntries(FEATURES.map((feature) => {
    const used = feature === "duo_reflection" ? reflectionUsage : counts.find((entry) => entry.feature === feature)?.request_count ?? 0;
    return [feature, { remaining: Math.max(0, limits[feature] - used), estimatedCostCents: 0 }];
  })) as AiSettings["usage"];
  return {
    personalEnabled: preference?.personal_enabled === 1,
    duoEnabled: preference?.duo_enabled === 1,
    mutualDuoConsent: duoId ? hasDuoReflectionConsent(duoId) : false,
    policyVersion: preference?.policy_version ?? DEFAULT_POLICY_VERSION,
    mode: preference?.personal_enabled === 1 ? coachingMode : "disabled",
    usage,
  };
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

export function recordAiAuditEvent(event: Omit<import("./types.js").AiAuditEvent, "createdAt">): void {
  db.prepare("INSERT INTO ai_audit_events (id, event_type, actor_user_id, duo_id, feature, policy_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(randomUUID(), event.eventType, event.actorUserId, event.duoId, event.feature, event.policyVersion, new Date().toISOString());
}

/** Deletes user-visible AI data. Pseudonymous short-lived quota debits remain so caps cannot be bypassed by deletion. */
export function deleteAiData(userId: string): void {
  pruneExpiredQuota();
  db.transaction(() => {
    db.prepare("DELETE FROM ai_preferences WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM ai_duo_consents WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM ai_audit_events WHERE actor_user_id = ?").run(userId);
  })();
}
