import { Hono } from "hono";
import { db } from "../db.js";
import { sessionAuth } from "../lib/authMiddleware.js";
import { lastNDays, today } from "../lib/dates.js";
import { computeDuoGrowth, computeUserWeekStats } from "../lib/weeklyStats.js";
import { getStreak } from "../lib/streaks.js";
import { getVerifier } from "../lib/verifier.js";
import type { AppEnv } from "../honoEnv.js";
import type { UserRow } from "../types.js";
import type { WeeklyStats } from "../lib/verifierTypes.js";

export const insightsRoutes = new Hono<AppEnv>();
insightsRoutes.use("*", sessionAuth);

insightsRoutes.get("/", async (c) => {
  const user = c.get("user");

  if (!user.duo_id) {
    return c.json({
      growthScore: 0,
      subscores: { discipline: 0, mind: 0, health: 0, consistency: 0 },
      prediction: { forUser: user.name, behavior: "get started", riskPercent: 0, reason: "No duo yet." },
      suggestion: "Create or join a duo to start tracking together.",
      strength: "You're set up and ready to go.",
      weeklyVerdict: "No data yet — this week is a blank canvas.",
    });
  }

  const date = today();
  const days = lastNDays(7, date);
  const partnerRow = db
    .prepare<[string, string], UserRow>(`SELECT * FROM users WHERE duo_id = ? AND id != ?`)
    .get(user.duo_id, user.id);
  const members = partnerRow ? [user, partnerRow] : [user];

  const streakRow = getStreak(user.duo_id);
  const { growthScore, subscores } = computeDuoGrowth(user.duo_id, members, streakRow.current_streak, days);

  const you = computeUserWeekStats(user, days);
  const partner = partnerRow ? computeUserWeekStats(partnerRow, days) : null;

  const stats: WeeklyStats = { days, you, partner, streak: streakRow.current_streak, growthScore, subscores };
  const narrative = await getVerifier().insights(stats);

  return c.json({ growthScore, subscores, ...narrative });
});
