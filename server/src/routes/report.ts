import { Hono } from "hono";
import { db } from "../db.js";
import { sessionAuth } from "../lib/authMiddleware.js";
import { lastNDays, today } from "../lib/dates.js";
import { computeDuoGrowth, computeUserWeekStats } from "../lib/weeklyStats.js";
import { getStreak } from "../lib/streaks.js";
import { isLiveMode } from "../lib/verifier.js";
import type { AppEnv } from "../honoEnv.js";
import type { UserRow } from "../types.js";

export const reportRoutes = new Hono<AppEnv>();
export const healthRoutes = new Hono<AppEnv>();

reportRoutes.use("*", sessionAuth);

const WORKOUT_TARGET_PER_WEEK = 6;

reportRoutes.get("/weekly", (c) => {
  const user = c.get("user");
  const date = today();
  const days = lastNDays(7, date);

  if (!user.duo_id) {
    const you = computeUserWeekStats(user, days);
    return c.json({
      studyTime: Math.round(you.studyMinutesAvg * days.length),
      workouts: { done: you.workoutsDone, target: WORKOUT_TARGET_PER_WEEK },
      goals: { done: Math.round(you.tasksRate * days.length), target: days.length },
      consistency: Math.round(you.tasksRate * 100),
      verdict: "Create or join a duo to unlock the shared weekly report.",
    });
  }

  const partnerRow = db
    .prepare<[string, string], UserRow>(`SELECT * FROM users WHERE duo_id = ? AND id != ?`)
    .get(user.duo_id, user.id);
  const you = computeUserWeekStats(user, days);
  const partner = partnerRow ? computeUserWeekStats(partnerRow, days) : null;
  const members = partnerRow ? [user, partnerRow] : [user];

  const streakRow = getStreak(user.duo_id);
  const { growthScore, subscores } = computeDuoGrowth(user.duo_id, members, streakRow.current_streak, days);

  const memberCount = partner ? 2 : 1;
  const studyTime = Math.round((you.studyMinutesAvg + (partner?.studyMinutesAvg ?? 0)) * days.length);
  const workoutsDone = you.workoutsDone + (partner?.workoutsDone ?? 0);
  const goalsDone = Math.round((you.tasksRate + (partner?.tasksRate ?? 0)) * days.length);
  const consistency = Math.round(subscores.consistency);

  return c.json({
    studyTime,
    workouts: { done: workoutsDone, target: WORKOUT_TARGET_PER_WEEK * memberCount },
    goals: { done: goalsDone, target: days.length * memberCount },
    consistency,
    verdict: `Growth score ${growthScore} this week — ${consistency}% consistency across ${memberCount === 2 ? "both of you" : "you"}.`,
  });
});

healthRoutes.get("/", (c) => c.json({ ok: true, mode: isLiveMode() ? "live" : "demo" }));
