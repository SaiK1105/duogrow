import { Hono, type Context } from "hono";

import { db } from "../db.js";
import type { AppEnv } from "../honoEnv.js";
import { sessionAuth } from "../lib/authMiddleware.js";
import { today, lastNDays } from "../lib/dates.js";
import { computeUserWeekStats } from "../lib/weeklyStats.js";
import { buildDuoReflectionContext, buildPersonalAiContext, type PersonalAiContextInput } from "../lib/ai/context.js";
import { AiLimitError, reserveAiRequest } from "../lib/ai/limits.js";
import { deleteAiData, getAiSettings, hasDuoReflectionConsent, recordAiAuditEvent, setDuoConsent } from "../lib/ai/policy.js";
import { OpenAiProvider } from "../lib/ai/openAiProvider.js";
import type { AiFeature, UserRow } from "../types.js";

const POLICY_VERSION = "1";
const ESTIMATED_COST_CENTS = 1;
const MAX_CHAT_CHARS = 500;

type AiContext = ReturnType<typeof buildPersonalAiContext> | ReturnType<typeof buildDuoReflectionContext>;

export interface AiRouteDependencies {
  buildContext?: (user: UserRow, feature: AiFeature) => AiContext;
}

class AiDuoUnavailableError extends Error {}

export function createAiRoutes(dependencies: AiRouteDependencies = {}): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();
  const buildContext = dependencies.buildContext ?? buildGenerationContext;
  routes.use("*", sessionAuth);

  routes.get("/settings", (c) => c.json(getAiSettings(c.get("user").id, today())));

  routes.put("/settings", async (c) => {
    const body = await jsonRecord(c);
    if (!body || !onlyKeys(body, ["personalEnabled", "duoEnabled"]) || typeof body.personalEnabled !== "boolean" || typeof body.duoEnabled !== "boolean") {
      return c.json({ error: "invalid settings" }, 400);
    }
    const user = c.get("user");
    const mode = body.personalEnabled ? (process.env.OPENAI_API_KEY?.trim() ? "live" : "demo") : "disabled";
    db.prepare(`INSERT INTO ai_preferences (user_id, personal_enabled, duo_enabled, policy_version, mode, updated_at) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET personal_enabled = excluded.personal_enabled, duo_enabled = excluded.duo_enabled, policy_version = excluded.policy_version, mode = excluded.mode, updated_at = excluded.updated_at`)
      .run(user.id, body.personalEnabled ? 1 : 0, body.duoEnabled ? 1 : 0, POLICY_VERSION, mode, new Date().toISOString());
    return c.json(getAiSettings(user.id, today()));
  });

  routes.put("/duo-consent", async (c) => {
    const body = await jsonRecord(c);
    if (!body || !onlyKeys(body, ["enabled"]) || typeof body.enabled !== "boolean") return c.json({ error: "invalid consent" }, 400);
    const user = c.get("user");
    if (!user.duo_id) return c.json({ error: "duo unavailable" }, 404);
    setDuoConsent(user.id, user.duo_id, body.enabled, POLICY_VERSION);
    return c.json({ enabled: body.enabled, mutual: hasDuoReflectionConsent(user.duo_id) });
  });

  routes.delete("/data", (c) => {
    deleteAiData(c.get("user").id);
    return c.body(null, 204);
  });

  routes.post("/daily-plan", (c) => generate(c, "daily_plan", undefined, buildContext));
  routes.post("/duo-reflection", (c) => generate(c, "duo_reflection", undefined, buildContext));
  routes.post("/potd-tutor", (c) => generate(c, "potd_tutor", undefined, buildContext));
  routes.post("/chat", async (c) => {
    const body = await jsonRecord(c);
    if (!body || !onlyKeys(body, ["message"]) || typeof body.message !== "string" || !body.message.trim() || body.message.length > MAX_CHAT_CHARS) {
      return c.json({ error: "invalid chat message" }, 400);
    }
    return generate(c, "chat", body.message, buildContext);
  });
  return routes;
}

export const aiRoutes = createAiRoutes();

async function generate(c: Context<AppEnv>, feature: AiFeature, userMessage: string | undefined, buildContext: (user: UserRow, feature: AiFeature) => AiContext): Promise<Response> {
  const user = c.get("user");
  const settings = getAiSettings(user.id, today());
  if (!settings.personalEnabled) return c.json({ error: "personal AI consent required" }, 403);

  let duoId: string | undefined;
  if (feature === "duo_reflection") {
    if (!user.duo_id) return c.json({ error: "duo unavailable" }, 404);
    if (!settings.duoEnabled || !hasDuoReflectionConsent(user.duo_id)) return c.json({ error: "mutual duo consent required" }, 403);
    duoId = user.duo_id;
  }

  try {
    const reservation = reserveAiRequest({ actorUserId: user.id, duoId, feature, estimatedCostCents: ESTIMATED_COST_CENTS, policyVersion: settings.policyVersion });
    try {
      const context = buildContext(user, feature);
      const result = await new OpenAiProvider().generate({ feature, context, userMessage });
      if (!result.text.trim()) throw new Error("provider returned no text");
      recordAiAuditEvent({ eventType: "completed", actorUserId: user.id, duoId: duoId ?? null, feature, policyVersion: settings.policyVersion });
      const usage = getAiSettings(user.id, today()).usage[feature];
      return c.json({ text: result.text, mode: result.mode, remaining: usage.remaining, estimatedCostCents: ESTIMATED_COST_CENTS });
    } catch (error) {
      reservation.rollback();
      throw error;
    }
  } catch (error) {
    if (error instanceof AiLimitError) return c.json({ error: "AI request limit reached" }, 429);
    if (error instanceof AiDuoUnavailableError) return c.json({ error: "duo unavailable" }, 404);
    return c.json({ error: "AI generation is unavailable" }, 503);
  }
}

function buildGenerationContext(user: UserRow, feature: AiFeature): AiContext {
  if (feature !== "duo_reflection") return buildPersonalAiContext(personalSource(user));
  if (!user.duo_id) throw new AiDuoUnavailableError();
  const partner = db.prepare<[string, string], UserRow>("SELECT * FROM users WHERE duo_id = ? AND id != ?").get(user.duo_id, user.id);
  if (!partner) throw new AiDuoUnavailableError();
  return buildDuoReflectionContext({ you: personalSource(user), partner: personalSource(partner) });
}

function personalSource(user: UserRow): PersonalAiContextInput {
  const config = safeConfig(user.config_json);
  const entries = db.prepare("SELECT module, target, status, value FROM daily_entries WHERE user_id = ? AND date = ?").all(user.id, today()) as Array<Record<string, unknown>>;
  const week = computeUserWeekStats(user, lastNDays(7, today()));
  return {
    goals: {
      wakeTargetMinutes: config.wake.targetMinutes,
      studyTargetMinutes: config.study.targetMinutes,
      workoutTarget: config.workout.target,
      dietTargetMin: config.diet.targetMin,
      dietTargetMax: config.diet.targetMax,
      taskTarget: config.tasks.target,
    },
    today: entries,
    week: {
      wakeRate: week.wakeRate,
      studyRate: week.studyRate,
      studyMinutesAvg: week.studyMinutesAvg,
      workoutRate: week.workoutRate,
      workoutsDone: week.workoutsDone,
      dietOnTargetRate: week.dietOnTargetRate,
      dietOnTargetDays: week.dietOnTargetDays,
      tasksRate: week.tasksRate,
      potdSolvedRate: week.potdSolvedRate,
      potdSolvedCount: week.potdSolvedCount,
    },
  };
}

function safeConfig(value: string): { wake: { targetMinutes: number }; study: { targetMinutes: number }; workout: { target: number }; diet: { targetMin: number; targetMax: number }; tasks: { target: number } } {
  try {
    const parsed = JSON.parse(value) as { wake?: { target?: string }; study?: { targetMinutes?: number }; workout?: { target?: number }; diet?: { targetMin?: number; targetMax?: number }; tasks?: { target?: number } };
    const [hours, minutes] = parsed.wake?.target?.split(":").map(Number) ?? [];
    return {
      wake: { targetMinutes: Number.isFinite(hours) && Number.isFinite(minutes) ? (hours * 60) + minutes : 390 },
      study: { targetMinutes: parsed.study?.targetMinutes ?? 120 },
      workout: { target: parsed.workout?.target ?? 1 },
      diet: { targetMin: parsed.diet?.targetMin ?? 1900, targetMax: parsed.diet?.targetMax ?? 2200 },
      tasks: { target: parsed.tasks?.target ?? 6 },
    };
  } catch {
    return { wake: { targetMinutes: 390 }, study: { targetMinutes: 120 }, workout: { target: 1 }, diet: { targetMin: 1900, targetMax: 2200 }, tasks: { target: 6 } };
  }
}

async function jsonRecord(c: Context<AppEnv>): Promise<Record<string, unknown> | null> {
  const body = await c.req.json().catch(() => null);
  return typeof body === "object" && body !== null && !Array.isArray(body) ? body as Record<string, unknown> : null;
}

function onlyKeys(body: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(body).every((key) => allowed.includes(key));
}
