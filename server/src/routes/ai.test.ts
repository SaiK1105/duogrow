import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { Hono } from "hono";

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "duogrow-ai-routes-"));

const [{ db }, { hashSessionToken }, { today }, { quotaSubject }, { aiRoutes, createAiRoutes }] = await Promise.all([
  import("../db.js"),
  import("../lib/session.js"),
  import("../lib/dates.js"),
  import("../lib/quotaIdentity.js"),
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

async function streamedAiWithoutContentLength(path: "/settings" | "/chat", token: string, method: "PUT" | "POST", chunks: Uint8Array[], targetApp = app): Promise<{ response: Response; cancelled: boolean }> {
  let cancelled = false;
  let chunkIndex = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[chunkIndex];
      chunkIndex += 1;
      if (chunk) {
        controller.enqueue(chunk);
      } else {
        controller.close();
      }
    },
    cancel() {
      cancelled = true;
    },
  });
  const request = new Request(`http://localhost/api/ai${path}`, {
    method,
    headers: headers(token),
    body,
    duplex: "half",
  } as RequestInit);
  assert.equal(request.headers.has("content-length"), false);
  return { response: await targetApp.request(request), cancelled };
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

test("AI settings and chat cancel oversized chunked JSON before state changes or provider dispatch", async () => {
  insertUser("user-bounded-settings", "token-bounded-settings");
  insertUser("user-bounded-chat", "token-bounded-chat", null);
  enablePersonal("user-bounded-chat");
  const encoder = new TextEncoder();
  const chunks = (body: unknown): Uint8Array[] => {
    const json = JSON.stringify(body);
    return [encoder.encode(json.slice(0, 1_024)), encoder.encode(json.slice(1_024))];
  };
  let providerCalls = 0;
  const boundedApp = new Hono();
  boundedApp.route("/api/ai", createAiRoutes({
    provider: { generate: async () => { providerCalls += 1; return { text: "must not run", mode: "demo" }; } },
  }));

  const settings = await streamedAiWithoutContentLength("/settings", "token-bounded-settings", "PUT", chunks({ personalEnabled: true, duoEnabled: true, padding: "x".repeat(5_000) }), boundedApp);
  assert.equal(settings.response.status, 413);
  assert.equal(settings.cancelled, true);
  assert.equal((db.prepare("SELECT count(*) AS count FROM ai_preferences WHERE user_id = ?").get("user-bounded-settings") as { count: number }).count, 0);
  assert.equal((db.prepare("SELECT count(*) AS count FROM ai_duo_consents WHERE user_id = ?").get("user-bounded-settings") as { count: number }).count, 0);

  const chat = await streamedAiWithoutContentLength("/chat", "token-bounded-chat", "POST", chunks({ message: "x".repeat(5_000) }), boundedApp);
  assert.equal(chat.response.status, 413);
  assert.equal(chat.cancelled, true);
  assert.equal(providerCalls, 0);
});

test("settings updates atomically record each partner's effective consent and revoke immediately", async () => {
  insertUser("user-duo-one", "token-duo-one", "duo-consent-pair");
  insertUser("user-duo-two", "token-duo-two", "duo-consent-pair");
  const first = await request("/settings", "token-duo-one", "PUT", { personalEnabled: true, duoEnabled: true });
  assert.equal(first.status, 200);
  const firstBody = await first.json() as { mutualDuoConsent: boolean; dailyBudgetRemainingCents: number };
  assert.equal(firstBody.mutualDuoConsent, false);
  assert.equal(firstBody.dailyBudgetRemainingCents, 3);
  const second = await request("/settings", "token-duo-two", "PUT", { personalEnabled: true, duoEnabled: true });
  assert.equal(second.status, 200);
  assert.equal((await second.json() as { mutualDuoConsent: boolean }).mutualDuoConsent, true);
  assert.equal((await request("/duo-reflection", "token-duo-one")).status, 200);
  assert.equal((await request("/settings", "token-duo-two", "PUT", { personalEnabled: true, duoEnabled: false })).status, 200);
  assert.equal((await request("/duo-reflection", "token-duo-one")).status, 403);
});

test("a consent revocation while reflection context is pending prevents provider dispatch", async () => {
  insertUser("user-race-one", "token-race-one", "duo-race");
  insertUser("user-race-two", "token-race-two", "duo-race");
  assert.equal((await request("/settings", "token-race-one", "PUT", { personalEnabled: true, duoEnabled: true })).status, 200);
  assert.equal((await request("/settings", "token-race-two", "PUT", { personalEnabled: true, duoEnabled: true })).status, 200);
  let startContext: (() => void) | undefined;
  let releaseContext: ((value: ReturnType<typeof import("../lib/ai/context.js").buildDuoReflectionContext>) => void) | undefined;
  const contextStarted = new Promise<void>((resolve) => { startContext = resolve; });
  const pendingContext = new Promise<ReturnType<typeof import("../lib/ai/context.js").buildDuoReflectionContext>>((resolve) => { releaseContext = resolve; });
  let providerCalls = 0;
  const raceApp = new Hono();
  raceApp.route("/api/ai", createAiRoutes({
    buildContext: () => { startContext?.(); return pendingContext; },
    provider: { generate: async () => { providerCalls += 1; return { text: "must not run", mode: "demo" }; } },
  }));
  const reflection = raceApp.request("http://localhost/api/ai/duo-reflection", { method: "POST", headers: headers("token-race-one") });
  await contextStarted;
  assert.equal((await request("/settings", "token-race-two", "PUT", { personalEnabled: true, duoEnabled: false })).status, 200);
  releaseContext?.({ you: { goals: {}, today: [], week: {} }, partner: { goals: {}, today: [], week: {} } });

  assert.equal((await reflection).status, 403);
  assert.equal(providerCalls, 0);
});

test("a personal consent revocation while any generation context is pending prevents provider dispatch and releases the reservation", async () => {
  insertUser("user-personal-race", "token-personal-race", null);
  enablePersonal("user-personal-race");
  let startContext: (() => void) | undefined;
  let releaseContext: ((value: ReturnType<typeof import("../lib/ai/context.js").buildPersonalAiContext>) => void) | undefined;
  const contextStarted = new Promise<void>((resolve) => { startContext = resolve; });
  const pendingContext = new Promise<ReturnType<typeof import("../lib/ai/context.js").buildPersonalAiContext>>((resolve) => { releaseContext = resolve; });
  let providerCalls = 0;
  const raceApp = new Hono();
  raceApp.route("/api/ai", createAiRoutes({
    buildContext: () => { startContext?.(); return pendingContext; },
    provider: { generate: async () => { providerCalls += 1; return { text: "must not run", mode: "demo" }; } },
  }));
  const before = db.prepare("SELECT COALESCE(SUM(request_count), 0) AS count FROM ai_quota_daily WHERE subject_hash = ?").get(quotaSubject("user-personal-race")) as { count: number };
  const plan = raceApp.request("http://localhost/api/ai/daily-plan", { method: "POST", headers: headers("token-personal-race") });
  await contextStarted;
  assert.equal((await request("/settings", "token-personal-race", "PUT", { personalEnabled: false, duoEnabled: false })).status, 200);
  releaseContext?.({ goals: {}, today: [], week: {} });

  assert.equal((await plan).status, 403);
  assert.equal(providerCalls, 0);
  assert.equal((db.prepare("SELECT COALESCE(SUM(request_count), 0) AS count FROM ai_quota_daily WHERE subject_hash = ?").get(quotaSubject("user-personal-race")) as { count: number }).count, before.count);
});

test("a revoked delayed Insight Explain request does not dispatch a provider or carry names and IDs", async () => {
  insertUser("user-insight-race", "token-insight-race", null);
  enablePersonal("user-insight-race");
  let startContext: (() => void) | undefined;
  let releaseContext: ((value: ReturnType<typeof import("../lib/ai/context.js").buildInsightsExplainContext>) => void) | undefined;
  const contextStarted = new Promise<void>((resolve) => { startContext = resolve; });
  const pendingContext = new Promise<ReturnType<typeof import("../lib/ai/context.js").buildInsightsExplainContext>>((resolve) => { releaseContext = resolve; });
  let providerCalls = 0;
  const raceApp = new Hono();
  raceApp.route("/api/ai", createAiRoutes({
    buildContext: () => { startContext?.(); return pendingContext; },
    provider: { generate: async () => { providerCalls += 1; return { text: "must not run", mode: "demo" }; } },
  }));
  const explanation = raceApp.request("http://localhost/api/ai/insights-explain", { method: "POST", headers: headers("token-insight-race") });
  await contextStarted;
  assert.equal((await request("/settings", "token-insight-race", "PUT", { personalEnabled: false, duoEnabled: false })).status, 200);
  const context = { growthScore: 82, subscores: { discipline: 80, mind: 82, health: 70, consistency: 90 }, riskPercent: 40 };
  releaseContext?.(context);

  assert.equal((await explanation).status, 403);
  assert.equal(providerCalls, 0);
  assert.doesNotMatch(JSON.stringify(context), /user-insight-race|token-insight-race|name|id/i);
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

test("chat reports only calls usable under the default daily budget", async () => {
  insertUser("user-chat-default-budget", "token-chat-default-budget", null);
  enablePersonal("user-chat-default-budget");

  const first = await request("/chat", "token-chat-default-budget", "POST", { message: "Help me plan." });
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), {
    text: "Choose the smallest next action you can finish today.",
    mode: "demo",
    remaining: 2,
    estimatedCostCents: 1,
  });

  assert.equal((await request("/chat", "token-chat-default-budget", "POST", { message: "Another step?" })).status, 200);
  assert.equal((await request("/chat", "token-chat-default-budget", "POST", { message: "One more?" })).status, 200);
  const limited = await request("/chat", "token-chat-default-budget", "POST", { message: "Can I continue?" });
  assert.equal(limited.status, 429);
  assert.deepEqual(await limited.json(), {
    error: "AI request limit reached",
    reason: "daily_budget",
    retry: "tomorrow",
  });
});

test("a provider-failure demo fallback releases both pseudonymous quota reservations", async () => {
  insertUser("user-live-fallback", "token-live-fallback");
  enablePersonal("user-live-fallback");
  const fallbackApp = new Hono();
  fallbackApp.route("/api/ai", createAiRoutes({
    provider: { generate: async () => ({ text: "Demo recovery.", mode: "demo", rollbackReservation: true }) },
  }));
  const beforeDaily = db.prepare("SELECT COALESCE(SUM(request_count), 0) AS count FROM ai_quota_daily WHERE subject_hash = ?").get(quotaSubject("user-live-fallback")) as { count: number };
  const beforeMonthly = db.prepare("SELECT COALESCE(reserved_cost_cents, 0) AS count FROM ai_project_quota_month WHERE month = ?").get(today().slice(0, 7)) as { count: number } | undefined;

  const response = await fallbackApp.request("http://localhost/api/ai/daily-plan", { method: "POST", headers: headers("token-live-fallback") });

  assert.equal(response.status, 200);
  assert.equal((db.prepare("SELECT COALESCE(SUM(request_count), 0) AS count FROM ai_quota_daily WHERE subject_hash = ?").get(quotaSubject("user-live-fallback")) as { count: number }).count, beforeDaily.count);
  assert.equal((db.prepare("SELECT COALESCE(reserved_cost_cents, 0) AS count FROM ai_project_quota_month WHERE month = ?").get(today().slice(0, 7)) as { count: number } | undefined)?.count ?? 0, beforeMonthly?.count ?? 0);
});

test("contextual coaching routes send only server-derived allow-listed insight and current-assignment fields", async () => {
  insertUser("user-contextual", "token-contextual", "duo-contextual");
  enablePersonal("user-contextual");
  const date = today();
  db.prepare("INSERT INTO potd_questions (id, duo_id, source, topic, difficulty, title, body, answer, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run("question-contextual", "duo-contextual", "private source", "Arrays", "easy", "Two Sum", "Find the pair.", "private answer", new Date().toISOString());
  db.prepare("INSERT INTO potd_assignments (id, duo_id, user_id, question_id, date, mode, status, proof_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run("assignment-contextual", "duo-contextual", "user-contextual", "question-contextual", date, "same", "assigned", "proof-secret", new Date().toISOString());
  const inputs: Array<{ feature: string; context: unknown }> = [];
  const contextualApp = new Hono();
  contextualApp.route("/api/ai", createAiRoutes({
    provider: { generate: async (input) => { inputs.push({ feature: input.feature, context: input.context }); return { text: "A narrow hint.", mode: "demo" }; } },
  }));

  assert.equal((await contextualApp.request("http://localhost/api/ai/potd-tutor", { method: "POST", headers: headers("token-contextual") })).status, 200);
  assert.equal((await contextualApp.request("http://localhost/api/ai/insights-explain", { method: "POST", headers: headers("token-contextual"), body: JSON.stringify({ browserSupplied: "never trusted" }) })).status, 200);

  assert.deepEqual(inputs[0], { feature: "potd_tutor", context: { assignment: { title: "Two Sum", body: "Find the pair.", topic: "Arrays", difficulty: "easy" } } });
  assert.deepEqual(Object.keys(inputs[1]?.context as Record<string, unknown>).sort(), ["growthScore", "riskPercent", "subscores"]);
  assert.doesNotMatch(JSON.stringify(inputs), /private source|private answer|proof-secret|assignment-contextual|question-contextual|browserSupplied/i);
});

test("daily plan quota produces 429", async () => {
  insertUser("user-quota", "token-quota");
  enablePersonal("user-quota");
  for (let index = 0; index < 3; index += 1) assert.equal((await request("/daily-plan", "token-quota")).status, 200);
  assert.equal((await request("/daily-plan", "token-quota")).status, 429);
});

test("weekly Duo Reflection limit returns a stable next-week retry contract", async () => {
  insertUser("user-weekly-limit-one", "token-weekly-limit-one", "duo-weekly-limit");
  insertUser("user-weekly-limit-two", "token-weekly-limit-two", "duo-weekly-limit");
  assert.equal((await request("/settings", "token-weekly-limit-one", "PUT", { personalEnabled: true, duoEnabled: true })).status, 200);
  assert.equal((await request("/settings", "token-weekly-limit-two", "PUT", { personalEnabled: true, duoEnabled: true })).status, 200);
  assert.equal((await request("/duo-reflection", "token-weekly-limit-one")).status, 200);

  const limited = await request("/duo-reflection", "token-weekly-limit-two");
  assert.equal(limited.status, 429);
  assert.deepEqual(await limited.json(), {
    error: "AI request limit reached",
    reason: "feature_quota",
    retry: "next_week",
  });
});

test("an exhausted quota does not build generation context", async () => {
  insertUser("user-quota-guard", "token-quota-guard");
  enablePersonal("user-quota-guard");
  db.prepare("INSERT INTO ai_quota_daily (subject_hash, duo_hash, feature, date, request_count, reserved_cost_cents) VALUES (?, NULL, 'daily_plan', ?, 3, 3)")
    .run(quotaSubject("user-quota-guard"), today());
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

test("deleting visible AI data does not reset today's quota after a user reconsents", async () => {
  insertUser("user-settings", "token-settings");
  assert.equal((await request("/settings", "token-settings", "PUT", { personalEnabled: true, duoEnabled: false })).status, 200);
  for (let index = 0; index < 3; index += 1) assert.equal((await request("/daily-plan", "token-settings")).status, 200);
  assert.equal((await request("/data", "token-settings", "DELETE")).status, 204);
  assert.equal((await request("/settings", "token-settings", "PUT", { personalEnabled: true, duoEnabled: false })).status, 200);
  assert.equal((await request("/daily-plan", "token-settings")).status, 429);
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
