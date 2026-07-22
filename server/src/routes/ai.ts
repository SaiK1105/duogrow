import { Hono, type Context } from "hono";

import { db } from "../db.js";
import type { AppEnv } from "../honoEnv.js";
import { sessionAuth } from "../lib/authMiddleware.js";
import { today, lastNDays } from "../lib/dates.js";
import { computeDuoGrowth, computeUserWeekStats } from "../lib/weeklyStats.js";
import { getStreak } from "../lib/streaks.js";
import { getVerifier } from "../lib/verifier.js";
import { buildDuoReflectionContext, buildInsightsExplainContext, buildPersonalAiContext, buildPotdTutorContext, type PersonalAiContextInput } from "../lib/ai/context.js";
import { AiLimitError, reserveAiRequest } from "../lib/ai/limits.js";
import { deleteAiData, getAiSettings, hasDuoReflectionConsent, recordAiAuditEvent, updateAiPreferences } from "../lib/ai/policy.js";
import { OpenAiProvider } from "../lib/ai/openAiProvider.js";
import type { AiFeature, UserRow } from "../types.js";
import type { AiProvider } from "../lib/ai/provider.js";
import type { WeeklyStats } from "../lib/verifierTypes.js";

const POLICY_VERSION = "1";
const ESTIMATED_COST_CENTS = 1;
const MAX_CHAT_CHARS = 500;

type AiContext = ReturnType<typeof buildPersonalAiContext> | ReturnType<typeof buildDuoReflectionContext> | ReturnType<typeof buildInsightsExplainContext> | ReturnType<typeof buildPotdTutorContext>;

export interface AiRouteDependencies {
  buildContext?: (user: UserRow, feature: AiFeature) => AiContext | Promise<AiContext>;
  provider?: AiProvider;
}

class AiDuoUnavailableError extends Error {}

export function createAiRoutes(dependencies: AiRouteDependencies = {}): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();
  const buildContext = dependencies.buildContext ?? buildGenerationContext;
  const provider = dependencies.provider ?? new OpenAiProvider();
  routes.use("*", sessionAuth);

  routes.get("/settings", (c) => c.json(getAiSettings(c.get("user").id, today())));

  routes.put("/settings", async (c) => {
    const body = await jsonRecord(c);
    if (!body || !onlyKeys(body, ["personalEnabled", "duoEnabled"]) || typeof body.personalEnabled !== "boolean" || typeof body.duoEnabled !== "boolean") {
      return c.json({ error: "invalid settings" }, 400);
    }
    const user = c.get("user");
    updateAiPreferences({ userId: user.id, duoId: user.duo_id, personalEnabled: body.personalEnabled, duoEnabled: body.duoEnabled, policyVersion: POLICY_VERSION });
    return c.json(getAiSettings(user.id, today()));
  });

  routes.delete("/data", (c) => {
    deleteAiData(c.get("user").id);
    return c.body(null, 204);
  });

  routes.post("/daily-plan", (c) => generate(c, "daily_plan", undefined, buildContext, provider));
  routes.post("/duo-reflection", (c) => generate(c, "duo_reflection", undefined, buildContext, provider));
  routes.post("/potd-tutor", (c) => generate(c, "potd_tutor", undefined, buildContext, provider));
  routes.post("/insights-explain", (c) => generate(c, "insights_explain", undefined, buildContext, provider));
  routes.post("/chat", async (c) => {
    const body = await jsonRecord(c);
    if (!body || !onlyKeys(body, ["message"]) || typeof body.message !== "string" || !body.message.trim() || body.message.length > MAX_CHAT_CHARS) {
      return c.json({ error: "invalid chat message" }, 400);
    }
    return generate(c, "chat", body.message, buildContext, provider);
  });
  return routes;
}

export const aiRoutes = createAiRoutes();

async function generate(c: Context<AppEnv>, feature: AiFeature, userMessage: string | undefined, buildContext: (user: UserRow, feature: AiFeature) => AiContext | Promise<AiContext>, provider: AiProvider): Promise<Response> {
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
      const context = await buildContext(user, feature);
      if (!getAiSettings(user.id, today()).personalEnabled) {
        reservation.rollback();
        return c.json({ error: "personal AI consent required" }, 403);
      }
      if (feature === "duo_reflection" && (!user.duo_id || !hasDuoReflectionConsent(user.duo_id))) {
        reservation.rollback();
        return c.json({ error: "mutual duo consent required" }, 403);
      }
      const result = await provider.generate({ feature, context, userMessage });
      if (!result.text.trim()) throw new Error("provider returned no text");
      if (result.rollbackReservation) reservation.rollback();
      else recordAiAuditEvent({ eventType: "completed", actorUserId: user.id, duoId: duoId ?? null, feature, policyVersion: settings.policyVersion });
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

async function buildGenerationContext(user: UserRow, feature: AiFeature): Promise<AiContext> {
  if (feature === "insights_explain") return buildInsightsExplainContext(await insightSource(user));
  if (feature === "potd_tutor") return buildPotdTutorContext(potdTutorSource(user));
  if (feature !== "duo_reflection") return buildPersonalAiContext(personalSource(user));
  if (!user.duo_id) throw new AiDuoUnavailableError();
  const partner = db.prepare<[string, string], UserRow>("SELECT * FROM users WHERE duo_id = ? AND id != ?").get(user.duo_id, user.id);
  if (!partner) throw new AiDuoUnavailableError();
  return buildDuoReflectionContext({ you: personalSource(user), partner: personalSource(partner) });
}

async function insightSource(user: UserRow): Promise<Record<string, unknown>> {
  if (!user.duo_id) {
    return {
      growthScore: 0, subscores: { discipline: 0, mind: 0, health: 0, consistency: 0 },
      prediction: { behavior: "get started", riskPercent: 0, reason: "No duo yet." },
      suggestion: "Create or join a duo to start tracking together.", strength: "You're set up and ready to go.", weeklyVerdict: "No data yet — this week is a blank canvas.",
    };
  }
  const days = lastNDays(7, today());
  const partner = db.prepare<[string, string], UserRow>("SELECT * FROM users WHERE duo_id = ? AND id != ?").get(user.duo_id, user.id);
  const members = partner ? [user, partner] : [user];
  const streak = getStreak(user.duo_id);
  const { growthScore, subscores } = computeDuoGrowth(user.duo_id, members, streak.current_streak, days);
  const stats: WeeklyStats = {
    days, you: computeUserWeekStats(user, days), partner: partner ? computeUserWeekStats(partner, days) : null,
    streak: streak.current_streak, growthScore, subscores,
  };
  const narrative = await getVerifier().insights(stats);
  return { growthScore, subscores, prediction: narrative.prediction, suggestion: narrative.suggestion, strength: narrative.strength, weeklyVerdict: narrative.weeklyVerdict };
}

function potdTutorSource(user: UserRow): Record<string, unknown> | null {
  const assignment = db.prepare<[string, string], { title: string; body: string; topic: string; difficulty: string }>(
    `SELECT q.title, q.body, q.topic, q.difficulty
     FROM potd_assignments a JOIN potd_questions q ON q.id = a.question_id
     WHERE a.user_id = ? AND a.date = ?`,
  ).get(user.id, today());
  return assignment ?? null;
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
