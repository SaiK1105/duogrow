import { db } from "../db.js";
import { ensureTodayAssignments } from "./potd.js";
import { defaultTarget, getUserModuleEntries } from "./snapshot.js";
import { today } from "./dates.js";
import { MODULE_NAMES, parseUserConfig, type ModuleName, type PotdStatus, type UserRow } from "../types.js";

export interface TodayContextItem {
  module: ModuleName | "potd";
  title: string;
  target: string | number | null;
  status: string;
}

/** The compact "TODAY CONTEXT" the AI verifier is shown alongside a proof image. */
export interface TodayContext {
  date: string;
  you: string;
  partner: string | null;
  items: TodayContextItem[];
}

function moduleTitle(module: ModuleName): string {
  switch (module) {
    case "wake":
      return "Morning wake-up";
    case "study":
      return "Study session";
    case "workout":
      return "Workout";
    case "diet":
      return "Calorie log";
    case "tasks":
      return "Daily tasks";
    default:
      return module;
  }
}

/** Build the today-context passed to the Verifier for one user's proof upload. */
export function buildTodayContext(user: UserRow, date: string = today()): TodayContext {
  const config = parseUserConfig(user.config_json);
  const entries = getUserModuleEntries(user.id, date);

  const items: TodayContextItem[] = MODULE_NAMES.map((module) => {
    const entry = entries.get(module);
    return {
      module,
      title: moduleTitle(module),
      target: entry?.target ?? defaultTarget(module, config),
      status: entry?.status ?? "pending",
    };
  });

  let partnerName: string | null = null;
  if (user.duo_id) {
    const partner = db
      .prepare<[string, string], { name: string }>(`SELECT name FROM users WHERE duo_id = ? AND id != ?`)
      .get(user.duo_id, user.id);
    partnerName = partner?.name ?? null;

    const question = ensureTodayAssignments(user.duo_id, date);
    if (question) {
      const assignment = db
        .prepare<[string, string], { status: PotdStatus }>(
          `SELECT status FROM potd_assignments WHERE user_id = ? AND date = ?`,
        )
        .get(user.id, date);
      items.push({
        module: "potd",
        title: question.title,
        target: question.difficulty,
        status: assignment?.status ?? "assigned",
      });
    }
  }

  return { date, you: user.name, partner: partnerName, items };
}

const COACH_LINES = [
  (streak: number) => `Day ${streak} of your streak — keep the chain alive.`,
  (streak: number, partnerName: string | null, partnerProgress: number) =>
    partnerName
      ? `${partnerName} is at ${partnerProgress}% today — a little nudge might close the gap.`
      : `Streak's at ${streak}. Log something today to keep it going.`,
  (streak: number, partnerName: string | null) =>
    partnerName ? `You and ${partnerName} are ${streak} days strong together.` : "Small wins add up — log today's progress.",
  () => "Consistency beats intensity. One module at a time.",
];

/** Pick a warm, data-grounded coach line for the Today screen. Rotates by day so it doesn't repeat within a session. */
export function pickCoachMessage(streak: number, partnerName: string | null, partnerProgress: number): string {
  const index = (streak + (partnerName?.length ?? 0)) % COACH_LINES.length;
  return COACH_LINES[index](streak, partnerName, partnerProgress);
}
