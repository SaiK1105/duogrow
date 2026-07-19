import type { DailyEntryRow, ModuleName, PotdAssignmentRow } from "../types.js";

export interface Subscores {
  /** 0-1 fraction: wake consistency + tasks completion + streak momentum. */
  discipline: number;
  /** 0-1 fraction: study-vs-target + POTD solve rate. */
  mind: number;
  /** 0-1 fraction: workout rate + diet-on-target rate. */
  health: number;
  /** 0-1 fraction: days with at least one verified/done action. */
  consistency: number;
}

export interface ScoringInput {
  /** YYYY-MM-DD strings, oldest first — typically lastNDays(7). */
  days: string[];
  /** daily_entries rows for every member of the duo, restricted to `days`. */
  entries: DailyEntryRow[];
  /** potd_assignments rows for every member of the duo, restricted to `days`. */
  potdAssignments: PotdAssignmentRow[];
  dietTargetMin: number;
  dietTargetMax: number;
  currentStreak: number;
}

/**
 * How "complete" a single daily_entries row is, as a 0-1 fraction.
 * An explicit "done" status always counts as full credit; otherwise we fall
 * back to value/target (e.g. 90 of 120 study minutes = 0.75). Missing rows
 * (no entry logged that day) score 0 — handled by callers passing undefined.
 */
export function moduleCompletion(entry: DailyEntryRow | undefined): number {
  if (!entry) return 0;
  if (entry.status === "done") return 1;
  if (entry.value != null && entry.target != null && entry.target > 0) {
    return Math.min(entry.value / entry.target, 1);
  }
  return 0;
}

/**
 * Diet is scored by landing inside the [min,max] calorie window, not by a
 * simple ratio — eating far over target is not "more complete" than hitting
 * the target exactly.
 */
export function dietOnTargetCompletion(
  entry: DailyEntryRow | undefined,
  targetMin: number,
  targetMax: number,
): number {
  if (!entry) return 0;
  if (entry.status === "done") return 1;
  if (entry.value != null && entry.value >= targetMin && entry.value <= targetMax) return 1;
  return 0;
}

function distinctUserIds(entries: DailyEntryRow[], potdAssignments: PotdAssignmentRow[]): string[] {
  const ids = new Set<string>();
  for (const e of entries) ids.add(e.user_id);
  for (const a of potdAssignments) ids.add(a.user_id);
  return [...ids];
}

function indexByUserDateModule(entries: DailyEntryRow[]): Map<string, DailyEntryRow> {
  const map = new Map<string, DailyEntryRow>();
  for (const e of entries) map.set(`${e.user_id}|${e.date}|${e.module}`, e);
  return map;
}

function indexByUserDate(assignments: PotdAssignmentRow[]): Map<string, PotdAssignmentRow> {
  const map = new Map<string, PotdAssignmentRow>();
  for (const a of assignments) map.set(`${a.user_id}|${a.date}`, a);
  return map;
}

/** Average, across every duo member, of their per-day rate for one module. */
function averageModuleRate(
  input: ScoringInput,
  userIds: string[],
  entryIndex: Map<string, DailyEntryRow>,
  module: ModuleName,
  completion: (entry: DailyEntryRow | undefined) => number,
): number {
  if (userIds.length === 0 || input.days.length === 0) return 0;
  const perUser = userIds.map((userId) => {
    const total = input.days.reduce(
      (sum, date) => sum + completion(entryIndex.get(`${userId}|${date}|${module}`)),
      0,
    );
    return total / input.days.length;
  });
  return perUser.reduce((a, b) => a + b, 0) / perUser.length;
}

function averagePotdSolveRate(
  input: ScoringInput,
  userIds: string[],
  assignmentIndex: Map<string, PotdAssignmentRow>,
): number {
  if (userIds.length === 0 || input.days.length === 0) return 0;
  const perUser = userIds.map((userId) => {
    const solved = input.days.filter((date) => assignmentIndex.get(`${userId}|${date}`)?.status === "solved").length;
    return solved / input.days.length;
  });
  return perUser.reduce((a, b) => a + b, 0) / perUser.length;
}

function activeDaysRate(
  input: ScoringInput,
  entryIndex: Map<string, DailyEntryRow>,
  assignmentIndex: Map<string, PotdAssignmentRow>,
  userIds: string[],
): number {
  if (input.days.length === 0) return 0;
  const activeCount = input.days.filter((date) =>
    userIds.some((userId) => {
      const hasDoneEntry = input.entries.some(
        (e) => e.user_id === userId && e.date === date && e.status === "done",
      );
      const hasSolvedPotd = assignmentIndex.get(`${userId}|${date}`)?.status === "solved";
      return hasDoneEntry || hasSolvedPotd;
    }),
  ).length;
  return activeCount / input.days.length;
}

export function computeSubscores(input: ScoringInput): Subscores {
  const userIds = distinctUserIds(input.entries, input.potdAssignments);
  const entryIndex = indexByUserDateModule(input.entries);
  const assignmentIndex = indexByUserDate(input.potdAssignments);

  const wakeRate = averageModuleRate(input, userIds, entryIndex, "wake", moduleCompletion);
  const tasksRate = averageModuleRate(input, userIds, entryIndex, "tasks", moduleCompletion);
  const studyRate = averageModuleRate(input, userIds, entryIndex, "study", moduleCompletion);
  const workoutRate = averageModuleRate(input, userIds, entryIndex, "workout", moduleCompletion);
  const dietRate = averageModuleRate(input, userIds, entryIndex, "diet", (entry) =>
    dietOnTargetCompletion(entry, input.dietTargetMin, input.dietTargetMax),
  );
  const potdRate = averagePotdSolveRate(input, userIds, assignmentIndex);
  const streakFactor = Math.min(input.currentStreak / 14, 1);

  const discipline = 0.4 * wakeRate + 0.4 * tasksRate + 0.2 * streakFactor;
  const mind = 0.6 * studyRate + 0.4 * potdRate;
  const health = 0.6 * workoutRate + 0.4 * dietRate;
  const consistency = activeDaysRate(input, entryIndex, assignmentIndex, userIds);

  return { discipline, mind, health, consistency };
}

/** Growth Score = round(100 * mean of the four subscores), per SPEC.md. */
export function computeGrowthScore(sub: Subscores): number {
  const mean = (sub.discipline + sub.mind + sub.health + sub.consistency) / 4;
  return Math.round(100 * mean);
}

/** Duo Progress % = mean of both partners' today-completion across their 5 modules + POTD. */
export function computeProgressPercent(moduleCompletions: number[], potdCompletion: number): number {
  const all = [...moduleCompletions, potdCompletion];
  if (all.length === 0) return 0;
  const mean = all.reduce((a, b) => a + b, 0) / all.length;
  return Math.round(mean * 100);
}

/**
 * Advance the duo's daily streak at most once per day. Returns the (possibly
 * unchanged) streak row fields. Callers persist the result themselves — kept
 * pure here so it's easy to reason about/test.
 */
export interface StreakState {
  currentStreak: number;
  longestStreak: number;
  lastDate: string | null;
}

export function advanceStreak(state: StreakState, date: string): StreakState {
  if (state.lastDate === date) return state; // already advanced today
  const isConsecutive = state.lastDate != null && isNextDay(state.lastDate, date);
  const currentStreak = isConsecutive ? state.currentStreak + 1 : 1;
  const longestStreak = Math.max(state.longestStreak, currentStreak);
  return { currentStreak, longestStreak, lastDate: date };
}

function isNextDay(prevDate: string, date: string): boolean {
  const prev = new Date(prevDate);
  const cur = new Date(date);
  const diffMs = cur.getTime() - prev.getTime();
  return diffMs === 24 * 60 * 60 * 1000;
}
