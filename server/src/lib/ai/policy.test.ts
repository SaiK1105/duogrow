import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { getAiRuntimeConfig } from "./config.js";

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "duogrow-ai-policy-"));

const { db } = await import("../../db.js");
const { AiConsentRequiredError, deleteAiData, getAiSettings, hasDuoReflectionConsent, setDuoConsent } = await import("./policy.js");

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
  setDuoConsent("user-2", "duo-1", true, "v1");
  assert.equal(hasDuoReflectionConsent("duo-1"), true);
});

test("deleting AI data retains all non-AI user data", () => {
  setDuoConsent("user-1", "duo-1", true, "v1");
  db.prepare("INSERT INTO ai_preferences (user_id, personal_enabled, duo_enabled, policy_version, mode, updated_at) VALUES (?, 1, 1, ?, ?, ?)").run("user-1", "v1", "demo", "2026-01-01");
  db.prepare("INSERT INTO ai_usage_daily (user_id, duo_id, feature, date, request_count, reserved_cost_cents) VALUES (?, ?, ?, ?, 1, 1)").run("user-1", "duo-1", "chat", "2026-01-01");
  db.prepare("INSERT INTO ai_audit_events (id, event_type, actor_user_id, duo_id, feature, policy_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run("audit-1", "reserved", "user-1", "duo-1", "chat", "v1", "2026-01-01");

  deleteAiData("user-1");

  assert.equal((db.prepare("SELECT count(*) AS count FROM users WHERE id = ?").get("user-1") as { count: number }).count, 1);
  assert.equal((db.prepare("SELECT count(*) AS count FROM ai_preferences WHERE user_id = ?").get("user-1") as { count: number }).count, 0);
  assert.equal((db.prepare("SELECT count(*) AS count FROM ai_duo_consents WHERE user_id = ?").get("user-1") as { count: number }).count, 0);
  assert.equal((db.prepare("SELECT count(*) AS count FROM ai_usage_daily WHERE user_id = ?").get("user-1") as { count: number }).count, 0);
  assert.equal((db.prepare("SELECT count(*) AS count FROM ai_audit_events WHERE actor_user_id = ?").get("user-1") as { count: number }).count, 0);
});

test("AI settings report configured feature quotas without reading global environment", () => {
  const settings = getAiSettings("user-configured-settings", "2026-01-01", getAiRuntimeConfig({
    AI_DAILY_CALLS_PER_USER: "2",
    AI_TUTOR_CALLS_PER_USER: "3",
    AI_CHAT_CALLS_PER_USER: "4",
    AI_REFLECTIONS_PER_DUO_PER_WEEK: "5",
  }));

  assert.deepEqual(settings.usage, {
    daily_plan: { remaining: 2, estimatedCostCents: 0 },
    duo_reflection: { remaining: 5, estimatedCostCents: 0 },
    potd_tutor: { remaining: 3, estimatedCostCents: 0 },
    chat: { remaining: 4, estimatedCostCents: 0 },
  });
});

test("duo reflection settings count a partner's earlier request in the same week", () => {
  db.prepare("INSERT INTO duos (id, name, invite_code, created_at) VALUES (?, ?, ?, ?)").run("duo-weekly", "Weekly", "invite-weekly", "2026-01-01");
  const insertUser = db.prepare("INSERT INTO users (id, name, duo_id, session_token, config_json, created_at) VALUES (?, ?, ?, ?, ?, ?)");
  insertUser.run("user-weekly-one", "One", "duo-weekly", "token-weekly-one", "{}", "2026-01-01");
  insertUser.run("user-weekly-two", "Two", "duo-weekly", "token-weekly-two", "{}", "2026-01-01");
  db.prepare("INSERT INTO ai_usage_daily (user_id, duo_id, feature, date, request_count, reserved_cost_cents) VALUES (?, ?, ?, ?, ?, ?)")
    .run("user-weekly-two", "duo-weekly", "duo_reflection", "2026-01-05", 1, 1);

  const settings = getAiSettings("user-weekly-one", "2026-01-07", getAiRuntimeConfig({ AI_REFLECTIONS_PER_DUO_PER_WEEK: "2" }));

  assert.equal(settings.usage.duo_reflection.remaining, 1);
});
