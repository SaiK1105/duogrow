import type { Difficulty, ModuleName } from "../types.js";
import type { TodayContext } from "./todayContext.js";

// Verdict contract — mirrors SPEC.md exactly:
//   { task_type, matched_module, confidence, band, evidence, extracted_metrics, coach_message }

export type TaskType = "wake" | "study" | "workout" | "diet" | "task" | "potd" | "unknown";
export type MatchedModule = ModuleName | "potd" | null;
export type ProofBand = "high" | "medium" | "low";
export type PotdVerdictStatus = "solved" | "attempted" | null;

export interface ExtractedMetrics {
  study_minutes: number | null;
  calories: number | null;
  wake_time: string | null;
  workout_name: string | null;
  problem_title: string | null;
  potd_status: PotdVerdictStatus;
  detected_text: string | null;
  timestamp_visible: string | null;
}

export interface Verdict {
  task_type: TaskType;
  matched_module: MatchedModule;
  confidence: number;
  band: ProofBand;
  evidence: string[];
  extracted_metrics: ExtractedMetrics;
  coach_message: string;
}

export type ModuleHint = ModuleName | "potd" | null;

export interface VerifyInput {
  filePath: string;
  mimeType: string;
  moduleHint: ModuleHint;
  todayContext: TodayContext;
}

export interface ExtractedQuestion {
  title: string;
  body: string;
  topic: string;
  difficulty: Difficulty;
  source: string;
  answer: string | null;
}

export interface ExtractResult {
  sourceTitle: string | null;
  questions: ExtractedQuestion[];
}

export interface ExtractInput {
  filePath: string;
  sourceName: string;
}

export interface UserWeekStats {
  userId: string;
  name: string;
  wakeRate: number;
  studyRate: number;
  studyMinutesAvg: number;
  workoutRate: number;
  workoutsDone: number;
  dietOnTargetRate: number;
  dietOnTargetDays: number;
  tasksRate: number;
  potdSolvedRate: number;
  potdSolvedCount: number;
  todayWorkoutDone: boolean;
  todayTasksRatio: number;
}

export interface WeeklyStats {
  days: string[];
  you: UserWeekStats;
  partner: UserWeekStats | null;
  streak: number;
  growthScore: number;
  subscores: { discipline: number; mind: number; health: number; consistency: number };
}

export interface InsightsPrediction {
  forUser: string;
  behavior: string;
  riskPercent: number;
  reason: string;
}

export interface InsightsNarrative {
  prediction: InsightsPrediction;
  suggestion: string;
  strength: string;
  weeklyVerdict: string;
}

/** The provider-agnostic seam: DemoVerifier and AnthropicVerifier both implement this. */
export interface Verifier {
  verify(input: VerifyInput): Promise<Verdict>;
  extractQuestions(input: ExtractInput): Promise<ExtractResult>;
  insights(stats: WeeklyStats): Promise<InsightsNarrative>;
}
