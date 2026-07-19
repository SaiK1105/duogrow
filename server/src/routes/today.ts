import { Hono } from "hono";
import { db } from "../db.js";
import { sessionAuth } from "../lib/authMiddleware.js";
import { lastNDays, today } from "../lib/dates.js";
import { buildUserSnapshot, computeDuoProgress } from "../lib/snapshot.js";
import { computeDuoGrowth } from "../lib/weeklyStats.js";
import { getStreak } from "../lib/streaks.js";
import { pickCoachMessage } from "../lib/todayContext.js";
import type { AppEnv } from "../honoEnv.js";
import type { CheerRow, UserRow } from "../types.js";

export const todayRoutes = new Hono<AppEnv>();
todayRoutes.use("*", sessionAuth);

todayRoutes.get("/", (c) => {
  const user = c.get("user");
  const date = today();

  if (!user.duo_id) {
    const you = buildUserSnapshot(user, date);
    return c.json({
      date,
      you,
      partner: null,
      duoProgress: you.progress,
      streak: 0,
      growthScore: 0,
      unseenCheers: [],
      coachMessage: "Create or join a duo to start tracking together.",
    });
  }

  const partnerRow = db
    .prepare<[string, string], UserRow>(`SELECT * FROM users WHERE duo_id = ? AND id != ?`)
    .get(user.duo_id, user.id);

  const you = buildUserSnapshot(user, date);
  const partner = partnerRow ? buildUserSnapshot(partnerRow, date) : null;
  const duoProgress = computeDuoProgress(you.progress, partner?.progress ?? null);

  const streakRow = getStreak(user.duo_id);
  const members = partnerRow ? [user, partnerRow] : [user];
  const { growthScore } = computeDuoGrowth(user.duo_id, members, streakRow.current_streak, lastNDays(7, date));

  const unseenCheerRows = db
    .prepare<[string], CheerRow>(`SELECT * FROM cheers WHERE to_user_id = ? AND seen = 0 ORDER BY created_at DESC`)
    .all(user.id);

  const nameById = new Map<string, string>([[user.id, user.name]]);
  if (partnerRow) nameById.set(partnerRow.id, partnerRow.name);

  const unseenCheers = unseenCheerRows.map((cheer) => ({
    id: cheer.id,
    emoji: cheer.emoji,
    message: cheer.message,
    fromName: nameById.get(cheer.from_user_id) ?? "Partner",
  }));

  const coachMessage = pickCoachMessage(streakRow.current_streak, partner?.name ?? null, partner?.progress ?? 0);

  return c.json({
    date,
    you,
    partner,
    duoProgress,
    streak: streakRow.current_streak,
    growthScore,
    unseenCheers,
    coachMessage,
  });
});
