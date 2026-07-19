import { db } from "../db.js";
import { newId } from "./ids.js";
import { advanceStreak, type StreakState } from "./scoring.js";
import type { StreakRow } from "../types.js";

const SCOPE = "duo";

/** Read the duo's current streak, defaulting to zero if none exists yet. */
export function getStreak(duoId: string): StreakRow {
  const row = db.prepare<[string, string], StreakRow>(`SELECT * FROM streaks WHERE duo_id = ? AND scope = ?`).get(duoId, SCOPE);
  if (row) return row;
  return { id: "", duo_id: duoId, scope: SCOPE, current_streak: 0, longest_streak: 0, last_date: null };
}

/**
 * Advance the duo's streak at most once per day — called on the first
 * HIGH-band verified proof by either partner. `last_date` is the guard.
 */
export function advanceDuoStreak(duoId: string, date: string): StreakRow {
  const existing = db.prepare<[string, string], StreakRow>(`SELECT * FROM streaks WHERE duo_id = ? AND scope = ?`).get(duoId, SCOPE);
  const state: StreakState = existing
    ? { currentStreak: existing.current_streak, longestStreak: existing.longest_streak, lastDate: existing.last_date }
    : { currentStreak: 0, longestStreak: 0, lastDate: null };

  const next = advanceStreak(state, date);

  if (existing) {
    db.prepare(`UPDATE streaks SET current_streak = ?, longest_streak = ?, last_date = ? WHERE id = ?`).run(
      next.currentStreak,
      next.longestStreak,
      next.lastDate,
      existing.id,
    );
    return { ...existing, current_streak: next.currentStreak, longest_streak: next.longestStreak, last_date: next.lastDate };
  }

  const id = newId("streak");
  db.prepare(
    `INSERT INTO streaks (id, duo_id, scope, current_streak, longest_streak, last_date) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, duoId, SCOPE, next.currentStreak, next.longestStreak, next.lastDate);
  return { id, duo_id: duoId, scope: SCOPE, current_streak: next.currentStreak, longest_streak: next.longestStreak, last_date: next.lastDate };
}

/** Directly set the streak — used only by seed.ts to establish the demo's starting state. */
export function setStreak(duoId: string, currentStreak: number, longestStreak: number, lastDate: string | null): void {
  const existing = db.prepare<[string, string], StreakRow>(`SELECT * FROM streaks WHERE duo_id = ? AND scope = ?`).get(duoId, SCOPE);
  if (existing) {
    db.prepare(`UPDATE streaks SET current_streak = ?, longest_streak = ?, last_date = ? WHERE id = ?`).run(
      currentStreak,
      longestStreak,
      lastDate,
      existing.id,
    );
    return;
  }
  db.prepare(
    `INSERT INTO streaks (id, duo_id, scope, current_streak, longest_streak, last_date) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(newId("streak"), duoId, SCOPE, currentStreak, longestStreak, lastDate);
}
