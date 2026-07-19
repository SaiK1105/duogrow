import { db } from "../db.js";
import { newId } from "./ids.js";
import { defaultTarget } from "./snapshot.js";
import { parseUserConfig, type DailyEntryRow, type ModuleName, type PotdAssignmentRow, type UserRow } from "../types.js";
import type { ModuleHint, Verdict } from "./verifierTypes.js";

export interface AppliedUpdate {
  module: ModuleName | "potd";
  status: string;
  value: number | null;
  note: string;
}

/**
 * What applying `verdict` to `targetModule` would do — used both as the
 * actual update (HIGH band) and as the "here's what would happen" preview
 * shown for a MEDIUM-band review card.
 */
export function describeUpdate(verdict: Verdict, targetModule: ModuleHint): AppliedUpdate | null {
  if (!targetModule) return null;
  const m = verdict.extracted_metrics;

  if (targetModule === "potd") {
    const status = m.potd_status === "solved" ? "solved" : "attempted";
    return { module: "potd", status, value: null, note: `Mark today's POTD as ${status}` };
  }

  switch (targetModule) {
    case "study":
      return { module: "study", status: "done", value: m.study_minutes, note: `Log ${m.study_minutes ?? "an unspecified number of"} study minutes` };
    case "diet":
      return { module: "diet", status: "done", value: m.calories, note: `Log ${m.calories ?? "an unspecified number of"} calories` };
    case "wake":
      return { module: "wake", status: "done", value: null, note: `Mark wake-up done${m.wake_time ? ` at ${m.wake_time}` : ""}` };
    case "workout":
      return { module: "workout", status: "done", value: null, note: `Mark workout done${m.workout_name ? ` (${m.workout_name})` : ""}` };
    case "tasks":
      return { module: "tasks", status: "done", value: null, note: "Mark today's tasks done" };
    default:
      return null;
  }
}

/**
 * Persist `update` — upserts daily_entries or potd_assignments and links the
 * proof. Does NOT touch the streak; callers decide when that's warranted
 * (SPEC: only the first HIGH-band verified proof of the day advances it).
 */
export function applyUpdate(user: UserRow, duoId: string, date: string, update: AppliedUpdate, proofId: string): void {
  const now = new Date().toISOString();

  if (update.module === "potd") {
    const existing = db
      .prepare<[string, string], PotdAssignmentRow>(`SELECT * FROM potd_assignments WHERE user_id = ? AND date = ?`)
      .get(user.id, date);
    if (existing) {
      db.prepare(`UPDATE potd_assignments SET status = ?, proof_id = ?, updated_at = ? WHERE id = ?`).run(
        update.status,
        proofId,
        now,
        existing.id,
      );
    }
    return;
  }

  const config = parseUserConfig(user.config_json);
  const existing = db
    .prepare<[string, string, string], DailyEntryRow>(
      `SELECT * FROM daily_entries WHERE user_id = ? AND date = ? AND module = ?`,
    )
    .get(user.id, date, update.module);

  const value = update.value ?? existing?.value ?? null;
  const target = existing?.target ?? defaultTarget(update.module, config);

  if (existing) {
    db.prepare(`UPDATE daily_entries SET status = ?, value = ?, target = ?, proof_id = ?, updated_at = ? WHERE id = ?`).run(
      update.status,
      value,
      target,
      proofId,
      now,
      existing.id,
    );
  } else {
    db.prepare(
      `INSERT INTO daily_entries (id, user_id, duo_id, date, module, status, value, target, detail_json, proof_id, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
    ).run(newId("entry"), user.id, duoId, date, update.module, update.status, value, target, proofId, now);
  }
}
