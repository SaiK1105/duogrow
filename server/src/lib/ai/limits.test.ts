import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { today } from "../dates.js";

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

test("failed provider reservation rolls usage and project budget back atomically", () => {
  const reservation = reserveAiRequest({ actorUserId: "user-2", feature: "chat", date: today(), estimatedCostCents: 2, policyVersion: "v1" });
  reservation.rollback();

  assert.equal((db.prepare("SELECT count(*) AS count FROM ai_usage_daily WHERE user_id = ?").get("user-2") as { count: number }).count, 0);
  assert.equal((db.prepare("SELECT count(*) AS count FROM ai_project_usage_month WHERE user_id = ? AND month = ?").get("user-2", "2026-07") as { count: number }).count, 0);
});

test("duo reflection quota denies a server-day request after an earlier Monday call", () => {
  const serverDay = new Date(`${today()}T00:00:00.000Z`);
  const monday = new Date(serverDay);
  monday.setUTCDate(serverDay.getUTCDate() - ((serverDay.getUTCDay() + 6) % 7));
  const mondayDate = monday.toISOString().slice(0, 10);
  db.prepare("INSERT INTO ai_usage_daily (user_id, duo_id, feature, date, request_count, reserved_cost_cents) VALUES (?, ?, ?, ?, 1, 1)")
    .run("user-monday", "duo-week", "duo_reflection", mondayDate);

  assert.throws(
    () => reserveAiRequest({ actorUserId: "user-wednesday", duoId: "duo-week", feature: "duo_reflection", date: today(), estimatedCostCents: 1, policyVersion: "v1" }),
    AiLimitError,
  );
});
