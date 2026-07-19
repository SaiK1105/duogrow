import { db } from "../db.js";
import { dietOnTargetCompletion, computeProgressPercent, moduleCompletion } from "./scoring.js";
import { ensureTodayAssignments } from "./potd.js";
import { timeToMinutes } from "./dates.js";
import {
  MODULE_NAMES,
  parseUserConfig,
  type DailyEntryRow,
  type Difficulty,
  type ModuleName,
  type PotdStatus,
  type UserConfig,
  type UserRow,
} from "../types.js";

export interface ModuleSnapshot {
  status: "pending" | "done";
  value: number | null;
  target: number | null;
  detail: unknown;
}

export interface PotdSnapshot {
  status: PotdStatus;
  title: string;
  difficulty: Difficulty;
  source: string;
}

export interface UserSnapshot {
  userId: string;
  name: string;
  progress: number;
  modules: Record<ModuleName, ModuleSnapshot>;
  potd: PotdSnapshot | null;
}

/** Default per-module target for a user, drawn from their config_json. */
export function defaultTarget(module: ModuleName, config: UserConfig): number | null {
  switch (module) {
    case "wake":
      return timeToMinutes(config.wake.target);
    case "study":
      return config.study.targetMinutes;
    case "workout":
      return config.workout.target;
    case "diet":
      return config.diet.targetMax;
    case "tasks":
      return config.tasks.target;
    default:
      return null;
  }
}

export function getUserModuleEntries(userId: string, date: string): Map<ModuleName, DailyEntryRow> {
  const rows = db
    .prepare<[string, string], DailyEntryRow>(`SELECT * FROM daily_entries WHERE user_id = ? AND date = ?`)
    .all(userId, date);
  const map = new Map<ModuleName, DailyEntryRow>();
  for (const row of rows) map.set(row.module, row);
  return map;
}

/** Build the full Today snapshot for one user (their 5 modules + POTD). */
export function buildUserSnapshot(user: UserRow, date: string): UserSnapshot {
  const config = parseUserConfig(user.config_json);
  const entries = getUserModuleEntries(user.id, date);
  const modules = {} as Record<ModuleName, ModuleSnapshot>;
  const completions: number[] = [];

  for (const module of MODULE_NAMES) {
    const entry = entries.get(module);
    modules[module] = {
      status: entry?.status ?? "pending",
      value: entry?.value ?? null,
      target: entry?.target ?? defaultTarget(module, config),
      detail: entry?.detail_json ? JSON.parse(entry.detail_json) : null,
    };
    completions.push(
      module === "diet"
        ? dietOnTargetCompletion(entry, config.diet.targetMin, config.diet.targetMax)
        : moduleCompletion(entry),
    );
  }

  let potd: PotdSnapshot | null = null;
  let potdCompletion = 0;
  if (user.duo_id) {
    const question = ensureTodayAssignments(user.duo_id, date);
    if (question) {
      const assignment = db
        .prepare<[string, string], { status: PotdStatus }>(
          `SELECT status FROM potd_assignments WHERE user_id = ? AND date = ?`,
        )
        .get(user.id, date);
      if (assignment) {
        potd = {
          status: assignment.status,
          title: question.title,
          difficulty: question.difficulty,
          source: question.source,
        };
        potdCompletion = assignment.status === "solved" ? 1 : assignment.status === "attempted" ? 0.5 : 0;
      }
    }
  }

  const progress = computeProgressPercent(completions, potdCompletion);
  return { userId: user.id, name: user.name, progress, modules, potd };
}

/** Duo Progress % = mean of both partners' today-completion. Falls back to solo progress if unpaired. */
export function computeDuoProgress(youProgress: number, partnerProgress: number | null): number {
  if (partnerProgress == null) return youProgress;
  return Math.round((youProgress + partnerProgress) / 2);
}
