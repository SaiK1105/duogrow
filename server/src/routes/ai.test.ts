import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { Hono } from "hono";

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "duogrow-ai-routes-"));

const [{ db }, { hashSessionToken }, { today }, { aiRoutes, createAiRoutes }] = await Promise.all([
  import("../db.js"),
  import("../lib/session.js"),
  import("../lib/dates.js"),
  import("./ai.js"),
]);

const app = new Hono();
app.route("/api/ai", aiRoutes);

function insertUser(id: string, token: string, duoId: string | null = "duo-1"): void {
  const now = new Date().toISOString();
  const hash = hashSessionToken(token);
  if (duoId) db.prepare("INSERT OR IGNORE INTO duos (id, name, invite_code, created_at) VALUES (?, ?, ?, ?)").run(duoId, "Duo", `CODE-${duoId}`, now);
  db.prepare("INSERT INTO users (id, name, duo_id, session_token, session_token_hash, config_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(id, id, duoId, hash, hash, "{}", now);
}

function headers(token: string): Record<string, string> {
  return { "content-type": "application/json", "x-session": token };
}

async function request(path: string, token: string, method = "POST", body?: unknown): Promise<Response> {
  return app.request(`http://localhost/api/ai${path}`, { method, headers: headers(token), body: body === undefined ? undefined : JSON.stringify(body) });
}

function enablePersonal(userId: string): void {
  db.prepare("INSERT INTO ai_preferences (user_id, personal_enabled, duo_enabled, policy_version, mode, updated_at) VALUES (?, 1, 0, '1', 'demo', ?)")
    .run(userId, new Date().toISOString());
}

test("AI generation requires personal consent", async () => {
  insertUser("user-consent", "token-consent");
  const response = await request("/daily-plan", "token-consent");
  assert.equal(response.status, 403);
});

test("chat rejects messages over 500 characters", async () => {
  insertUser("user-chat-length", "token-chat-length");
  enablePersonal("user-chat-length");
  const response = await request("/chat", "token-chat-length", "POST", { message: "x".repeat(501) });
  assert.equal(response.status, 400);
});

test("duo reflection succeeds with two current opt-ins and fails after either revokes", async () => {
  insertUser("user-duo-one", "token-duo-one", "duo-consent-pair");
  insertUser("user-duo-two", "token-duo-two", "duo-consent-pair");
  assert.equal((await request("/settings", "token-duo-one", "PUT", { personalEnabled: true, duoEnabled: true })).status, 200);
  assert.equal((await request("/settings", "token-duo-two", "PUT", { personalEnabled: true, duoEnabled: true })).status, 200);
  assert.equal((await request("/duo-consent", "token-duo-one", "PUT", { enabled: true })).status, 200);
  assert.equal((await request("/duo-consent", "token-duo-two", "PUT", { enabled: true })).status, 200);
  assert.equal((await request("/duo-reflection", "token-duo-one")).status, 200);
  assert.equal((await request("/duo-consent", "token-duo-two", "PUT", { enabled: false })).status, 200);
  assert.equal((await request("/duo-reflection", "token-duo-one")).status, 403);
});

test("daily plan returns a labelled demo response", async () => {
  insertUser("user-demo", "token-demo");
  enablePersonal("user-demo");
  const response = await request("/daily-plan", "token-demo");
  assert.equal(response.status, 200);
  const body = await response.json() as { text: string; mode: string; remaining: number; estimatedCostCents: number };
  assert.equal(body.mode, "demo");
  assert.ok(body.text.length > 0);
  assert.equal(typeof body.remaining, "number");
  assert.equal(typeof body.estimatedCostCents, "number");
});

test("daily plan quota produces 429", async () => {
  insertUser("user-quota", "token-quota");
  enablePersonal("user-quota");
  for (let index = 0; index < 3; index += 1) assert.equal((await request("/daily-plan", "token-quota")).status, 200);
  assert.equal((await request("/daily-plan", "token-quota")).status, 429);
});

test("an exhausted quota does not build generation context", async () => {
  insertUser("user-quota-guard", "token-quota-guard");
  enablePersonal("user-quota-guard");
  db.prepare("INSERT INTO ai_usage_daily (user_id, duo_id, feature, date, request_count, reserved_cost_cents) VALUES (?, NULL, 'daily_plan', ?, 3, 3)")
    .run("user-quota-guard", today());
  let contextBuilds = 0;
  const guardedApp = new Hono();
  guardedApp.route("/api/ai", createAiRoutes({
    buildContext: () => {
      contextBuilds += 1;
      throw new Error("context must not be built after quota rejection");
    },
  }));
  const response = await guardedApp.request("http://localhost/api/ai/daily-plan", { method: "POST", headers: headers("token-quota-guard") });
  assert.equal(response.status, 429);
  assert.equal(contextBuilds, 0);
});

test("settings update, consent revocation, and AI data deletion are available", async () => {
  insertUser("user-settings", "token-settings");
  assert.equal((await request("/settings", "token-settings", "PUT", { personalEnabled: true, duoEnabled: true })).status, 200);
  assert.equal((await request("/duo-consent", "token-settings", "PUT", { enabled: true })).status, 200);
  assert.equal((await request("/duo-consent", "token-settings", "PUT", { enabled: false })).status, 200);
  assert.equal((await request("/data", "token-settings", "DELETE")).status, 204);
  assert.equal((await request("/settings", "token-settings", "GET")).status, 200);
});

test("chat text never becomes an AI database record", async () => {
  insertUser("user-private-chat", "token-private-chat");
  enablePersonal("user-private-chat");
  const secret = "do-not-persist-this-chat-body";
  assert.equal((await request("/chat", "token-private-chat", "POST", { message: secret })).status, 200);
  const tables = ["ai_preferences", "ai_duo_consents", "ai_usage_daily", "ai_project_usage_month", "ai_audit_events"];
  for (const table of tables) {
    const rows = db.prepare(`SELECT * FROM ${table}`).all();
    assert.doesNotMatch(JSON.stringify(rows), new RegExp(secret));
  }
});
