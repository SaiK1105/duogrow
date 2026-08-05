import { db } from "../db.js";
import { lastNDays, addDays } from "./dates.js";
import { moduleCompletion } from "./scoring.js";
import { computeDuoGrowth, type DuoSubscores } from "./weeklyStats.js";
import { getStreak } from "./streaks.js";
import type { DailyEntryRow, ModuleName, UserRow } from "../types.js";

/** Ranges are an explicit allow-list so a malformed value cannot silently widen a query. */
export const ANALYTICS_RANGES = [30, 90, 365] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

const ANALYTICS_MODULES: readonly ModuleName[] = ["wake", "study", "workout", "diet", "tasks"];

export function parseAnalyticsRange(raw: string | undefined): AnalyticsRange | null {
  if (raw === undefined) return 30;
  const parsed = Number(raw);
  return (ANALYTICS_RANGES as readonly number[]).includes(parsed) ? (parsed as AnalyticsRange) : null;
}

export interface AnalyticsMember {
  userId: string;
  name: string;
}

/** `values` is parallel to `members`, so the client never needs an id lookup map. */
export interface AnalyticsDayPoint {
  date: string;
  values: number[];
}

export interface AnalyticsModuleRow {
  module: ModuleName;
  averages: number[];
  doneDays: number[];
}

export interface AnalyticsPeriod {
  from: string;
  to: string;
  growthScore: number;
  subscores: DuoSubscores;
  completion: number[];
}

export interface AnalyticsSummary {
  range: { from: string; to: string; days: number };
  members: AnalyticsMember[];
  series: AnalyticsDayPoint[];
  modules: AnalyticsModuleRow[];
  current: AnalyticsPeriod;
  previous: AnalyticsPeriod;
}

interface EntryKey {
  userId: string;
  date: string;
  module: ModuleName;
}

function keyOf(entry: EntryKey): string {
  return `${entry.userId}|${entry.date}|${entry.module}`;
}

function loadEntries(duoId: string, days: string[]): Map<string, DailyEntryRow> {
  const rows = db
    .prepare<[string, string, string], DailyEntryRow>(
      `SELECT * FROM daily_entries WHERE duo_id = ? AND date BETWEEN ? AND ?`,
    )
    .all(duoId, days[0], days[days.length - 1]);
  const index = new Map<string, DailyEntryRow>();
  for (const row of rows) index.set(keyOf({ userId: row.user_id, date: row.date, module: row.module }), row);
  return index;
}

/**
 * Mean completion across all five modules for one member on one day. A missing
 * entry scores zero rather than being skipped, so an unlogged day reads as a
 * gap instead of silently raising the average of the days that were logged.
 */
function dayCompletion(index: Map<string, DailyEntryRow>, userId: string, date: string): number {
  let total = 0;
  for (const module of ANALYTICS_MODULES) {
    total += moduleCompletion(index.get(keyOf({ userId, date, module })));
  }
  return total / ANALYTICS_MODULES.length;
}

function buildPeriod(duoId: string, members: UserRow[], days: string[]): AnalyticsPeriod {
  const index = loadEntries(duoId, days);
  const streak = getStreak(duoId).current_streak;
  const growth = computeDuoGrowth(duoId, members, streak, days);
  const completion = members.map((member) => {
    const total = days.reduce((sum, date) => sum + dayCompletion(index, member.id, date), 0);
    return total / days.length;
  });
  return {
    from: days[0],
    to: days[days.length - 1],
    growthScore: growth.growthScore,
    subscores: growth.subscores,
    completion,
  };
}

/**
 * Builds every chart's data in one pass so the dashboard needs a single request.
 *
 * Growth score is reported per period rather than per day on purpose: it is
 * defined over a window, so a daily value would be noise rather than a trend.
 * The per-day series carries completion, which is genuinely a daily quantity.
 */
export function buildAnalyticsSummary(duoId: string, members: UserRow[], range: AnalyticsRange): AnalyticsSummary {
  const days = lastNDays(range);
  const index = loadEntries(duoId, days);

  const series: AnalyticsDayPoint[] = days.map((date) => ({
    date,
    values: members.map((member) => dayCompletion(index, member.id, date)),
  }));

  const modules: AnalyticsModuleRow[] = ANALYTICS_MODULES.map((module) => ({
    module,
    averages: members.map((member) => {
      const total = days.reduce(
        (sum, date) => sum + moduleCompletion(index.get(keyOf({ userId: member.id, date, module }))),
        0,
      );
      return total / days.length;
    }),
    doneDays: members.map(
      (member) =>
        days.filter((date) => index.get(keyOf({ userId: member.id, date, module }))?.status === "done").length,
    ),
  }));

  const previousDays = lastNDays(range, addDays(days[0], -1));

  return {
    range: { from: days[0], to: days[days.length - 1], days: range },
    members: members.map((member) => ({ userId: member.id, name: member.name })),
    series,
    modules,
    current: buildPeriod(duoId, members, days),
    previous: buildPeriod(duoId, members, previousDays),
  };
}
