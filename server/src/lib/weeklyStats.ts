import { db } from "../db.js";
import { computeGrowthScore, computeSubscores, dietOnTargetCompletion, moduleCompletion } from "./scoring.js";
import { parseUserConfig, type DailyEntryRow, type ModuleName, type PotdAssignmentRow, type UserRow } from "../types.js";
import type { UserWeekStats } from "./verifierTypes.js";

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Aggregate one user's daily_entries + potd_assignments over `days` into weekly rates. */
export function computeUserWeekStats(user: UserRow, days: string[]): UserWeekStats {
  const config = parseUserConfig(user.config_json);
  const entries = db
    .prepare<[string, string, string], DailyEntryRow>(
      `SELECT * FROM daily_entries WHERE user_id = ? AND date BETWEEN ? AND ?`,
    )
    .all(user.id, days[0], days[days.length - 1]);
  const assignments = db
    .prepare<[string, string, string], PotdAssignmentRow>(
      `SELECT * FROM potd_assignments WHERE user_id = ? AND date BETWEEN ? AND ?`,
    )
    .all(user.id, days[0], days[days.length - 1]);

  const byModule = (module: ModuleName): (DailyEntryRow | undefined)[] =>
    days.map((date) => entries.find((e) => e.date === date && e.module === module));

  const wakeRate = average(byModule("wake").map(moduleCompletion));
  const tasksRate = average(byModule("tasks").map(moduleCompletion));
  const studyEntries = byModule("study");
  const studyRate = average(studyEntries.map(moduleCompletion));
  const studyMinutesAvg = average(studyEntries.map((e) => e?.value ?? 0));

  const workoutEntries = byModule("workout");
  const workoutsDone = workoutEntries.filter((e) => e?.status === "done").length;
  const workoutRate = workoutsDone / days.length;

  const dietEntries = byModule("diet");
  const dietOnTargetDays = dietEntries.filter(
    (e) => dietOnTargetCompletion(e, config.diet.targetMin, config.diet.targetMax) === 1,
  ).length;
  const dietOnTargetRate = dietOnTargetDays / days.length;

  const potdSolvedCount = assignments.filter((a) => a.status === "solved").length;
  const potdSolvedRate = potdSolvedCount / days.length;

  const todayWorkout = workoutEntries[days.length - 1];
  const todayTasks = byModule("tasks")[days.length - 1];

  return {
    userId: user.id,
    name: user.name,
    wakeRate,
    studyRate,
    studyMinutesAvg,
    workoutRate,
    workoutsDone,
    dietOnTargetRate,
    dietOnTargetDays,
    tasksRate,
    potdSolvedRate,
    potdSolvedCount,
    todayWorkoutDone: todayWorkout?.status === "done",
    todayTasksRatio: moduleCompletion(todayTasks),
  };
}

export interface DuoSubscores {
  discipline: number;
  mind: number;
  health: number;
  consistency: number;
}

export interface DuoGrowthResult {
  growthScore: number;
  subscores: DuoSubscores;
}

/**
 * Duo-level Growth Score over the last 7 days (both members combined), per
 * SPEC.md's formulas. The diet target window is averaged across both
 * members' configs since a single duo score needs a single window.
 */
export function computeDuoGrowth(duoId: string, members: UserRow[], currentStreak: number, days: string[]): DuoGrowthResult {
  const entries = db
    .prepare<[string, string, string], DailyEntryRow>(
      `SELECT * FROM daily_entries WHERE duo_id = ? AND date BETWEEN ? AND ?`,
    )
    .all(duoId, days[0], days[days.length - 1]);
  const potdAssignments = db
    .prepare<[string, string, string], PotdAssignmentRow>(
      `SELECT * FROM potd_assignments WHERE duo_id = ? AND date BETWEEN ? AND ?`,
    )
    .all(duoId, days[0], days[days.length - 1]);

  const configs = members.map((m) => parseUserConfig(m.config_json));
  const dietTargetMin = average(configs.map((c) => c.diet.targetMin));
  const dietTargetMax = average(configs.map((c) => c.diet.targetMax));

  const sub = computeSubscores({ days, entries, potdAssignments, dietTargetMin, dietTargetMax, currentStreak });
  const growthScore = computeGrowthScore(sub);

  return {
    growthScore,
    subscores: {
      discipline: Math.round(sub.discipline * 100),
      mind: Math.round(sub.mind * 100),
      health: Math.round(sub.health * 100),
      consistency: Math.round(sub.consistency * 100),
    },
  };
}
