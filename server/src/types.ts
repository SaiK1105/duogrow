// Shared row shapes (raw SQLite rows) and small domain types used across
// lib/ and routes/. Kept in one place so route handlers and lib functions
// agree on field names without re-declaring them.

export type ModuleName = "wake" | "study" | "workout" | "diet" | "tasks";
export const MODULE_NAMES: ModuleName[] = ["wake", "study", "workout", "diet", "tasks"];

export type EntryStatus = "pending" | "done";
export type ProofBand = "high" | "medium" | "low";
export type AiStatus = "pending" | "verified" | "review" | "rejected" | "error";
export type PotdStatus = "assigned" | "attempted" | "solved";
export type Difficulty = "easy" | "medium" | "hard";

export interface UserConfig {
  wake: { target: string };
  study: { targetMinutes: number };
  workout: { target: number };
  diet: { targetMin: number; targetMax: number };
  tasks: { target: number };
}

export const DEFAULT_USER_CONFIG: UserConfig = {
  wake: { target: "06:30" },
  study: { targetMinutes: 120 },
  workout: { target: 1 },
  diet: { targetMin: 1900, targetMax: 2200 },
  tasks: { target: 6 },
};

export interface DuoRow {
  id: string;
  name: string;
  invite_code: string;
  potd_mode: string;
  created_by: string | null;
  created_at: string;
}

export interface UserRow {
  id: string;
  name: string;
  duo_id: string | null;
  session_token: string;
  config_json: string;
  created_at: string;
}

export interface DailyEntryRow {
  id: string;
  user_id: string;
  duo_id: string;
  date: string;
  module: ModuleName;
  status: EntryStatus;
  value: number | null;
  target: number | null;
  detail_json: string | null;
  proof_id: string | null;
  updated_at: string;
}

export interface ProofRow {
  id: string;
  user_id: string;
  duo_id: string;
  date: string;
  file_path: string;
  mime_type: string;
  target_module: string | null;
  target_ref_id: string | null;
  ai_status: AiStatus;
  ai_confidence: number | null;
  ai_band: ProofBand | null;
  ai_summary: string | null;
  ai_evidence_json: string | null;
  ai_metrics_json: string | null;
  ai_coach_message: string | null;
  ai_applied_update_json: string | null;
  created_at: string;
}

export interface PotdQuestionRow {
  id: string;
  duo_id: string;
  source: string;
  topic: string;
  difficulty: Difficulty;
  title: string;
  body: string;
  answer: string | null;
  created_at: string;
}

export interface PotdAssignmentRow {
  id: string;
  duo_id: string;
  user_id: string;
  question_id: string;
  date: string;
  mode: string;
  status: PotdStatus;
  proof_id: string | null;
  updated_at: string;
}

export interface StreakRow {
  id: string;
  duo_id: string;
  scope: string;
  current_streak: number;
  longest_streak: number;
  last_date: string | null;
}

export interface CheerRow {
  id: string;
  duo_id: string;
  from_user_id: string;
  to_user_id: string;
  message: string | null;
  emoji: string;
  seen: number;
  created_at: string;
}

export function parseUserConfig(configJson: string): UserConfig {
  try {
    return { ...DEFAULT_USER_CONFIG, ...JSON.parse(configJson) };
  } catch {
    return DEFAULT_USER_CONFIG;
  }
}
