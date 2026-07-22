import { db } from "../../db.js";
import { today } from "../dates.js";

/** Removes only quota debits whose daily/monthly enforcement windows have ended. */
export function pruneExpiredQuota(date: string = today()): void {
  db.transaction(() => pruneExpiredQuotaRows(date))();
}

/** Transaction-friendly form for callers that already hold the reservation transaction. */
export function pruneExpiredQuotaRows(date: string): void {
  db.prepare("DELETE FROM ai_quota_daily WHERE (feature = 'duo_reflection' AND date < ?) OR (feature != 'duo_reflection' AND date < ?)")
    .run(weekStart(date), date);
  db.prepare("DELETE FROM ai_project_quota_month WHERE month < ?").run(date.slice(0, 7));
}

function weekStart(date: string): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() - ((value.getUTCDay() + 6) % 7));
  return value.toISOString().slice(0, 10);
}
