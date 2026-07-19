import { basename } from "node:path";
import { fnv1a } from "./potd.js";
import type {
  ExtractInput,
  ExtractResult,
  InsightsNarrative,
  ModuleHint,
  TaskType,
  Verdict,
  Verifier,
  VerifyInput,
  WeeklyStats,
} from "./verifierTypes.js";

/**
 * Deterministic, zero-cost verifier. Active whenever ANTHROPIC_API_KEY is
 * unset, DEMO_FAKE_AI=1, or the live AnthropicVerifier fails — "the demo
 * never dies." Produces realistic, stable verdicts from the module hint,
 * filename keywords, and seeded today-context data.
 */
export class DemoVerifier implements Verifier {
  async verify(input: VerifyInput): Promise<Verdict> {
    const module = inferModule(input.moduleHint, input.filePath);
    const confidence = seededConfidence(input.filePath);
    const partnerName = input.todayContext.partner;

    return {
      task_type: taskTypeFor(module),
      matched_module: module,
      confidence,
      band: "high",
      evidence: evidenceFor(module),
      extracted_metrics: metricsFor(module, input.todayContext),
      coach_message: coachMessageFor(module, partnerName),
    };
  }

  async extractQuestions(_input: ExtractInput): Promise<ExtractResult> {
    // PDF extraction is gated to live mode at the route level (CSV is the
    // zero-cost path in demo mode), so this should not normally be called.
    return { sourceTitle: null, questions: [] };
  }

  async insights(stats: WeeklyStats): Promise<InsightsNarrative> {
    return buildDemoInsights(stats);
  }
}

function inferModule(hint: ModuleHint, filePath: string): NonNullable<ModuleHint> {
  if (hint) return hint;
  const name = basename(filePath).toLowerCase();
  if (/workout|gym/.test(name)) return "workout";
  if (/leetcode|potd|code/.test(name)) return "potd";
  if (/study|pomodoro|forest/.test(name)) return "study";
  if (/food|meal|cal/.test(name)) return "diet";
  if (/alarm|wake/.test(name)) return "wake";
  return "workout";
}

function seededConfidence(filePath: string): number {
  const hash = fnv1a(basename(filePath));
  return 88 + (hash % 9); // stable value in [88,96]
}

function taskTypeFor(module: NonNullable<ModuleHint>): TaskType {
  switch (module) {
    case "tasks":
      return "task";
    case "wake":
    case "study":
    case "workout":
    case "diet":
    case "potd":
      return module;
    default:
      return "unknown";
  }
}

function evidenceFor(module: NonNullable<ModuleHint>): string[] {
  switch (module) {
    case "workout":
      return [
        "Screenshot of a workout app recognized",
        "Timestamp visible: this morning",
        "Completed session summary detected",
      ];
    case "study":
      return [
        "Study timer app screenshot recognized",
        "Session duration clearly visible",
        "Timestamp matches today",
      ];
    case "diet":
      return [
        "Food logging app screenshot recognized",
        "Calorie total clearly visible",
        "Meal entry timestamped today",
      ];
    case "wake":
      return [
        "Alarm/clock app screenshot recognized",
        "Wake time clearly visible",
        "Dismissal timestamp matches this morning",
      ];
    case "potd":
      return [
        "Code editor / judge screenshot recognized",
        "Accepted result banner visible",
        "Problem title matches today's POTD",
      ];
    case "tasks":
      return ["Task list screenshot recognized", "Checked-off items clearly visible", "Timestamp matches today"];
    default:
      return ["Screenshot recognized", "Content consistent with claimed activity", "Timestamp plausible"];
  }
}

function metricsFor(module: NonNullable<ModuleHint>, context: VerifyInput["todayContext"]) {
  const base = {
    study_minutes: null as number | null,
    calories: null as number | null,
    wake_time: null as string | null,
    workout_name: null as string | null,
    problem_title: null as string | null,
    potd_status: null as "solved" | "attempted" | null,
    detected_text: null as string | null,
    timestamp_visible: "this morning",
  };

  switch (module) {
    case "workout":
      return { ...base, workout_name: "Push day", detected_text: "Workout Complete — 42 min" };
    case "study":
      return { ...base, study_minutes: 95, detected_text: "Forest session: 1h 35m" };
    case "diet":
      return { ...base, calories: 610, detected_text: "Meal logged: 610 kcal" };
    case "wake":
      return { ...base, wake_time: "06:24", detected_text: "Alarm dismissed 06:24" };
    case "potd": {
      const potdItem = context.items.find((i) => i.module === "potd");
      return {
        ...base,
        problem_title: potdItem?.title ?? "Today's problem",
        potd_status: "solved" as const,
        detected_text: "Accepted",
      };
    }
    default:
      return { ...base, detected_text: "4 of 6 tasks checked off" };
  }
}

function coachMessageFor(module: NonNullable<ModuleHint>, partnerName: string | null): string {
  const nudge = partnerName ? ` ${partnerName} is going to be proud of this one.` : " Keep the streak alive.";
  switch (module) {
    case "workout":
      return `Nice work getting the sweat in today.${nudge}`;
    case "study":
      return `Solid focus block — that adds up fast.${nudge}`;
    case "diet":
      return `Logged and on track — small consistent choices win the week.${nudge}`;
    case "wake":
      return `Up and at it early — that sets the tone for everything else today.${nudge}`;
    case "potd":
      return `Nice, that problem's in the books.${nudge}`;
    default:
      return `Good progress today.${nudge}`;
  }
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function buildDemoInsights(stats: WeeklyStats): InsightsNarrative {
  const candidates = [stats.you, stats.partner].filter((u): u is NonNullable<typeof u> => u != null);
  const scored = candidates.map((u) => {
    const completionAvg = average([u.wakeRate, u.tasksRate, u.workoutRate, u.dietOnTargetRate, u.studyRate]);
    const todayLoadPenalty = u.todayWorkoutDone ? 0 : 15;
    const taskLoadPenalty = u.todayTasksRatio < 0.5 ? 10 : 0;
    const riskScore = Math.round((1 - completionAvg) * 60 + todayLoadPenalty + taskLoadPenalty);
    return { u, riskScore };
  });
  scored.sort((a, b) => b.riskScore - a.riskScore);
  const top = scored[0];

  if (!top) {
    return {
      prediction: { forUser: "you", behavior: "stay on track", riskPercent: 20, reason: "no data yet" },
      suggestion: "Log today's activity to start building your streak.",
      strength: "You're just getting started — every log counts.",
      weeklyVerdict: "A fresh week, ready to build momentum.",
    };
  }

  const behavior = !top.u.todayWorkoutDone
    ? "skip tomorrow's workout"
    : top.u.dietOnTargetRate < 0.6
      ? "miss tomorrow's calorie target"
      : "fall behind on tasks";
  const riskPercent = Math.max(35, Math.min(90, top.riskScore));
  const reason = !top.u.todayWorkoutDone
    ? `${top.u.name}'s workout is still pending today and the task load has been heavy this week.`
    : `${top.u.name}'s consistency has dipped this week (${Math.round(top.u.tasksRate * 100)}% on tasks).`;

  const strongest = [...candidates].sort((a, b) => b.workoutRate + b.tasksRate - (a.workoutRate + a.tasksRate))[0];
  const strength = strongest
    ? `${strongest.name} has logged wake-ups on ${Math.round(strongest.wakeRate * 7)} of the last 7 days.`
    : "The duo is building a solid foundation this week.";

  return {
    prediction: { forUser: top.u.name, behavior, riskPercent, reason },
    suggestion: !top.u.todayWorkoutDone
      ? `Send ${top.u.name} a cheer before end of day to close out the workout.`
      : "Block 20 minutes tomorrow morning for the highest-priority task first.",
    strength,
    weeklyVerdict: `Growth score sits at ${stats.growthScore} — a solid week with room to close the gap on the weaker days.`,
  };
}
