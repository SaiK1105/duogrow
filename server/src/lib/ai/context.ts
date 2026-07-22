const GOAL_FIELDS = ["wakeTargetMinutes", "studyTargetMinutes", "workoutTarget", "dietTargetMin", "dietTargetMax", "taskTarget"] as const;
const WEEK_FIELDS = [
  "wakeRate", "studyRate", "studyMinutesAvg", "workoutRate", "workoutsDone",
  "dietOnTargetRate", "dietOnTargetDays", "tasksRate", "potdSolvedRate", "potdSolvedCount", "growthScore",
] as const;
const TODAY_MODULES = new Set(["wake", "study", "workout", "diet", "tasks", "potd"]);
const TODAY_STATUSES = new Set(["pending", "done", "assigned", "attempted", "solved"]);
const DIFFICULTIES = new Set(["easy", "medium", "hard"]);
const INSIGHT_SUBSCORES = ["discipline", "mind", "health", "consistency"] as const;

/** Raw application data accepted at the AI boundary; unlisted properties never cross it. */
export interface PersonalAiContextInput {
  goals: Record<string, unknown>;
  today: Array<Record<string, unknown>>;
  week: Record<string, unknown>;
  [key: string]: unknown;
}

export interface PersonalAiContext {
  goals: Partial<Record<(typeof GOAL_FIELDS)[number], number>>;
  today: Array<{ module: string; target: number | null; status: string; value: number | null }>;
  week: Partial<Record<(typeof WEEK_FIELDS)[number], number>>;
}

export interface DuoReflectionContextInput {
  you: PersonalAiContextInput;
  partner: PersonalAiContextInput;
  [key: string]: unknown;
}

export interface DuoReflectionContext {
  you: PersonalAiContext;
  partner: PersonalAiContext;
}

export interface InsightsExplainContext {
  growthScore: number;
  subscores: Record<(typeof INSIGHT_SUBSCORES)[number], number>;
  prediction: { behavior: string; riskPercent: number; reason: string };
  suggestion: string;
  strength: string;
  weeklyVerdict: string;
}

export interface PotdTutorContext {
  assignment: { title: string; body: string; topic: string; difficulty: "easy" | "medium" | "hard" } | null;
}

function numericFields<const Fields extends readonly string[]>(source: Record<string, unknown>, fields: Fields): Partial<Record<Fields[number], number>> {
  const result: Partial<Record<Fields[number], number>> = {};
  for (const field of fields) {
    const value = source[field];
    if (typeof value === "number" && Number.isFinite(value)) result[field as Fields[number]] = value;
  }
  return result;
}

function minimizeTodayEntry(entry: Record<string, unknown>): { module: string; target: number | null; status: string; value: number | null } | null {
  if (typeof entry.module !== "string" || !TODAY_MODULES.has(entry.module)) return null;
  if (typeof entry.status !== "string" || !TODAY_STATUSES.has(entry.status)) return null;
  return {
    module: entry.module,
    target: typeof entry.target === "number" && Number.isFinite(entry.target) ? entry.target : null,
    status: entry.status,
    value: typeof entry.value === "number" && Number.isFinite(entry.value) ? entry.value : null,
  };
}

/** Creates a fresh, named allow-list view with no identifiers, prose, raw JSON, or media fields. */
export function buildPersonalAiContext(input: PersonalAiContextInput): PersonalAiContext {
  return {
    goals: numericFields(input.goals, GOAL_FIELDS),
    today: input.today.map(minimizeTodayEntry).filter((entry): entry is NonNullable<typeof entry> => entry !== null),
    week: numericFields(input.week, WEEK_FIELDS),
  };
}

/** Applies the exact same minimizer to both positional reflection views; names never enter the output. */
export function buildDuoReflectionContext(input: DuoReflectionContextInput): DuoReflectionContext {
  return { you: buildPersonalAiContext(input.you), partner: buildPersonalAiContext(input.partner) };
}

/** Minimizes server-derived insight output before it crosses the provider boundary. */
export function buildInsightsExplainContext(input: Record<string, unknown>): InsightsExplainContext {
  const subscores = input.subscores && typeof input.subscores === "object" ? input.subscores as Record<string, unknown> : {};
  const prediction = input.prediction && typeof input.prediction === "object" ? input.prediction as Record<string, unknown> : {};
  return {
    growthScore: finiteNumber(input.growthScore),
    subscores: {
      discipline: finiteNumber(subscores.discipline), mind: finiteNumber(subscores.mind), health: finiteNumber(subscores.health), consistency: finiteNumber(subscores.consistency),
    },
    prediction: { behavior: boundedText(prediction.behavior, 160), riskPercent: finiteNumber(prediction.riskPercent), reason: boundedText(prediction.reason, 300) },
    suggestion: boundedText(input.suggestion, 300),
    strength: boundedText(input.strength, 300),
    weeklyVerdict: boundedText(input.weeklyVerdict, 400),
  };
}

/** Keeps POTD tutoring specific to the current assignment while excluding identifiers, source, answers, and proof data. */
export function buildPotdTutorContext(input: Record<string, unknown> | null): PotdTutorContext {
  if (!input || !DIFFICULTIES.has(input.difficulty as string)) return { assignment: null };
  return {
    assignment: {
      title: boundedText(input.title, 160),
      body: boundedText(input.body, 2_000),
      topic: boundedText(input.topic, 100),
      difficulty: input.difficulty as "easy" | "medium" | "hard",
    },
  };
}

function finiteNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function boundedText(value: unknown, limit: number): string {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}
