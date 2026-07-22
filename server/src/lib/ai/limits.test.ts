import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { today } from "../dates.js";
import { quotaSubject } from "../quotaIdentity.js";
import { getAiRuntimeConfig } from "./config.js";

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "duogrow-ai-limits-"));

const { db } = await import("../../db.js");
const { AiLimitError, reserveAiRequest } = await import("./limits.js");

test("daily feature caps raise a typed limit error", () => {
  for (let index = 0; index < 3; index += 1) reserveAiRequest({ actorUserId: "user-1", feature: "daily_plan", date: today(), estimatedCostCents: 1, policyVersion: "v1" });
  assert.throws(
    () => reserveAiRequest({ actorUserId: "user-1", feature: "daily_plan", date: today(), estimatedCostCents: 1, policyVersion: "v1" }),
    AiLimitError,
  );
});

test("daily feature cap uses an injected validated configuration", () => {
  const config = getAiRuntimeConfig({ AI_DAILY_CALLS_PER_USER: "1" });
  const request = { actorUserId: "user-configured-cap", feature: "daily_plan" as const, date: today(), estimatedCostCents: 1, policyVersion: "v1" };
  reserveAiRequest(request, config);

  assert.throws(() => reserveAiRequest(request, config), AiLimitError);
});

test("failed provider reservation rolls usage and project budget back atomically", () => {
  const month = today().slice(0, 7);
  const beforeProjectRows = (db.prepare("SELECT count(*) AS count FROM ai_project_quota_month WHERE month = ?").get(month) as { count: number }).count;
  const reservation = reserveAiRequest({ actorUserId: "user-2", feature: "chat", date: today(), estimatedCostCents: 2, policyVersion: "v1" });
  reservation.rollback();

  assert.equal((db.prepare("SELECT count(*) AS count FROM ai_quota_daily WHERE subject_hash = ?").get(quotaSubject("user-2")) as { count: number }).count, 0);
  assert.equal((db.prepare("SELECT count(*) AS count FROM ai_project_quota_month WHERE month = ?").get(month) as { count: number }).count, beforeProjectRows);
});

test("reservation prunes expired pseudonymous daily and monthly quota records", () => {
  db.prepare("INSERT INTO ai_quota_daily (subject_hash, duo_hash, feature, date, request_count, reserved_cost_cents) VALUES (?, NULL, ?, ?, 1, 1)")
    .run(quotaSubject("expired-user"), "chat", "2000-01-01");
  db.prepare("INSERT INTO ai_project_quota_month (month, reserved_cost_cents) VALUES (?, ?)").run("2000-01", 1);

  reserveAiRequest({ actorUserId: "active-user", feature: "chat", date: today(), estimatedCostCents: 1, policyVersion: "v1" });

  assert.equal((db.prepare("SELECT count(*) AS count FROM ai_quota_daily WHERE date < ?").get(today()) as { count: number }).count, 0);
  assert.equal((db.prepare("SELECT count(*) AS count FROM ai_project_quota_month WHERE month < ?").get(today().slice(0, 7)) as { count: number }).count, 0);
});

test("duo reflection quota denies a server-day request after an earlier Monday call", () => {
  const serverDay = new Date(`${today()}T00:00:00.000Z`);
  const monday = new Date(serverDay);
  monday.setUTCDate(serverDay.getUTCDate() - ((serverDay.getUTCDay() + 6) % 7));
  const mondayDate = monday.toISOString().slice(0, 10);
  db.prepare("INSERT INTO ai_quota_daily (subject_hash, duo_hash, feature, date, request_count, reserved_cost_cents) VALUES (?, ?, ?, ?, 1, 1)")
    .run(quotaSubject("user-monday"), quotaSubject("duo-week"), "duo_reflection", mondayDate);

  assert.throws(
    () => reserveAiRequest({ actorUserId: "user-wednesday", duoId: "duo-week", feature: "duo_reflection", date: today(), estimatedCostCents: 1, policyVersion: "v1" }),
    AiLimitError,
  );
});
