import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { getAiRuntimeConfig, getCoachingMode } from "./config.js";
import { quotaSubject } from "../quotaIdentity.js";
import { today } from "../dates.js";

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "duogrow-ai-policy-"));

const { db } = await import("../../db.js");
const { AiConsentRequiredError, deleteAiData, getAiSettings, hasDuoReflectionConsent, setDuoConsent } = await import("./policy.js");
const { reserveAiRequest } = await import("./limits.js");

function seedDuo(): void {
  db.prepare("INSERT INTO duos (id, name, invite_code, created_at) VALUES (?, ?, ?, ?)").run("duo-1", "Duo", "invite-1", "2026-01-01");
  const insert = db.prepare("INSERT INTO users (id, name, duo_id, session_token, config_json, created_at) VALUES (?, ?, ?, ?, ?, ?)");
  insert.run("user-1", "One", "duo-1", "token-1", "{}", "2026-01-01");
  insert.run("user-2", "Two", "duo-1", "token-2", "{}", "2026-01-01");
}

test("duo reflection requires both current partners to consent", () => {
  seedDuo();
  assert.equal(hasDuoReflectionConsent("duo-1"), false);
  assert.throws(() => AiConsentRequiredError.assert("duo-1"), AiConsentRequiredError);
  setDuoConsent("user-1", "duo-1", true, "v1");
  assert.equal(hasDuoReflectionConsent("duo-1"), false);
  db.prepare("INSERT INTO ai_preferences (user_id, personal_enabled, duo_enabled, policy_version, mode, updated_at) VALUES (?, 1, 1, ?, ?, ?)").run("user-1", "v1", "demo", "2026-01-01");
  db.prepare("INSERT INTO ai_preferences (user_id, personal_enabled, duo_enabled, policy_version, mode, updated_at) VALUES (?, 1, 1, ?, ?, ?)").run("user-2", "v1", "demo", "2026-01-01");
  setDuoConsent("user-2", "duo-1", true, "v1");
  assert.equal(hasDuoReflectionConsent("duo-1"), true);
  db.prepare("UPDATE ai_preferences SET personal_enabled = 0 WHERE user_id = ?").run("user-2");
  assert.equal(hasDuoReflectionConsent("duo-1"), false);
  db.prepare("DELETE FROM ai_preferences WHERE user_id IN (?, ?)").run("user-1", "user-2");
});

test("deleting AI data retains all non-AI user data and the pseudonymous quota debits", () => {
  setDuoConsent("user-1", "duo-1", true, "v1");
  db.prepare("INSERT INTO ai_preferences (user_id, personal_enabled, duo_enabled, policy_version, mode, updated_at) VALUES (?, 1, 1, ?, ?, ?)").run("user-1", "v1", "demo", "2026-01-01");
  reserveAiRequest({ actorUserId: "user-1", duoId: "duo-1", feature: "chat", date: today(), estimatedCostCents: 1, policyVersion: "v1" });
  db.prepare("INSERT INTO ai_quota_daily (subject_hash, duo_hash, feature, date, request_count, reserved_cost_cents) VALUES (?, NULL, ?, ?, 1, 1)")
    .run("expired-pseudonym", "chat", "2000-01-01");
  db.prepare("INSERT INTO ai_project_quota_month (month, reserved_cost_cents) VALUES (?, 1)").run("2000-01");
  db.prepare("INSERT INTO ai_audit_events (id, event_type, actor_user_id, duo_id, feature, policy_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run("audit-1", "reserved", "user-1", "duo-1", "chat", "v1", "2026-01-01");

  deleteAiData("user-1");

  assert.equal((db.prepare("SELECT count(*) AS count FROM users WHERE id = ?").get("user-1") as { count: number }).count, 1);
  assert.equal((db.prepare("SELECT count(*) AS count FROM ai_preferences WHERE user_id = ?").get("user-1") as { count: number }).count, 0);
  assert.equal((db.prepare("SELECT count(*) AS count FROM ai_duo_consents WHERE user_id = ?").get("user-1") as { count: number }).count, 0);
  assert.equal((db.prepare("SELECT count(*) AS count FROM ai_quota_daily").get() as { count: number }).count, 1);
  assert.equal((db.prepare("SELECT count(*) AS count FROM ai_project_quota_month").get() as { count: number }).count, 1);
  assert.equal((db.prepare("SELECT count(*) AS count FROM ai_quota_daily WHERE date < ?").get(today()) as { count: number }).count, 0);
  assert.equal((db.prepare("SELECT count(*) AS count FROM ai_audit_events WHERE actor_user_id = ?").get("user-1") as { count: number }).count, 0);
});

test("AI settings report configured usable request counts without reading global environment", () => {
  const settings = getAiSettings("user-configured-settings", "2026-01-01", getAiRuntimeConfig({
    AI_DAILY_CALLS_PER_USER: "2",
    AI_TUTOR_CALLS_PER_USER: "3",
    AI_CHAT_CALLS_PER_USER: "4",
    AI_REFLECTIONS_PER_DUO_PER_WEEK: "5",
  }));

  assert.deepEqual(settings.usage, {
    daily_plan: { remaining: 2, estimatedCostCents: 1 },
    duo_reflection: { remaining: 3, estimatedCostCents: 1 },
    potd_tutor: { remaining: 3, estimatedCostCents: 1 },
    chat: { remaining: 3, estimatedCostCents: 1 },
    insights_explain: { remaining: 2, estimatedCostCents: 1 },
  });
  assert.equal(settings.dailyBudgetRemainingCents, 3);
});

test("AI settings report the current shared daily cent balance separately from feature quotas", () => {
  const userId = "user-daily-budget";
  const date = today();
  db.prepare("INSERT INTO users (id, name, duo_id, session_token, config_json, created_at) VALUES (?, ?, NULL, ?, ?, ?)")
    .run(userId, "Daily budget", "token-daily-budget", "{}", new Date().toISOString());
  db.prepare("INSERT INTO ai_quota_daily (subject_hash, duo_hash, feature, date, request_count, reserved_cost_cents) VALUES (?, NULL, ?, ?, ?, ?)")
    .run(quotaSubject(userId), "chat", date, 2, 2);

  const settings = getAiSettings(userId, date, getAiRuntimeConfig({ AI_USER_DAILY_BUDGET_CENTS: "3", AI_CHAT_CALLS_PER_USER: "10" }));

  assert.equal(settings.dailyBudgetRemainingCents, 1);
  assert.equal(settings.usage.chat.remaining, 1);
});

test("AI settings derive the coaching mode from current provider availability instead of a saved preference", () => {
  db.prepare("INSERT INTO users (id, name, duo_id, session_token, config_json, created_at) VALUES (?, ?, NULL, ?, ?, ?)")
    .run("user-mode-transition", "Mode transition", "token-mode-transition", "{}", "2026-01-01");
  db.prepare("INSERT INTO ai_preferences (user_id, personal_enabled, duo_enabled, policy_version, mode, updated_at) VALUES (?, 1, 0, ?, ?, ?)")
    .run("user-mode-transition", "v1", "disabled", "2026-01-01");

  assert.equal(getAiSettings("user-mode-transition", "2026-01-01", getAiRuntimeConfig({}), getCoachingMode({})).mode, "demo");
  assert.equal(getAiSettings("user-mode-transition", "2026-01-01", getAiRuntimeConfig({}), getCoachingMode({ OPENAI_API_KEY: "available-after-redeploy" })).mode, "live");
  assert.equal(getAiSettings("user-mode-transition", "2026-01-01", getAiRuntimeConfig({}), getCoachingMode({})).mode, "demo");
});

test("duo reflection settings count a partner's earlier request in the same week", () => {
  db.prepare("INSERT INTO duos (id, name, invite_code, created_at) VALUES (?, ?, ?, ?)").run("duo-weekly", "Weekly", "invite-weekly", "2026-01-01");
  const insertUser = db.prepare("INSERT INTO users (id, name, duo_id, session_token, config_json, created_at) VALUES (?, ?, ?, ?, ?, ?)");
  insertUser.run("user-weekly-one", "One", "duo-weekly", "token-weekly-one", "{}", "2026-01-01");
  insertUser.run("user-weekly-two", "Two", "duo-weekly", "token-weekly-two", "{}", "2026-01-01");
  db.prepare("INSERT INTO ai_quota_daily (subject_hash, duo_hash, feature, date, request_count, reserved_cost_cents) VALUES (?, ?, ?, ?, ?, ?)")
    .run(quotaSubject("user-weekly-two"), quotaSubject("duo-weekly"), "duo_reflection", "2026-01-05", 1, 1);

  const settings = getAiSettings("user-weekly-one", "2026-01-07", getAiRuntimeConfig({ AI_REFLECTIONS_PER_DUO_PER_WEEK: "2" }));

  assert.equal(settings.usage.duo_reflection.remaining, 1);
});
