import assert from "node:assert/strict";
import test from "node:test";

import { buildDuoReflectionContext, buildInsightsExplainContext, buildPersonalAiContext } from "./context.js";

test("personal AI context copies only explicitly approved fields", () => {
  const context = buildPersonalAiContext({
    goals: { studyTargetMinutes: 120, taskTarget: 4, arbitraryNumeric: 999, id: "goal-id" },
    today: [{
      module: "study", target: 120, status: "done", value: 30,
      detail_json: '{"secret":"no"}', proof_id: "proof-1", file_path: "/private/file.jpg",
      id: "entry-id", user_id: "user-1", metadata: { invite_code: "secret", calories: 9999 }, arbitraryNumeric: 42,
    }],
    week: { studyRate: 0.7, growthScore: 78, userId: "user-1", name: "private", arbitraryNumeric: 123 },
    arbitraryDetail: "must not cross the boundary",
  });

  assert.deepEqual(Object.keys(context).sort(), ["goals", "today", "week"]);
  assert.deepEqual(context, {
    goals: { studyTargetMinutes: 120, taskTarget: 4 },
    today: [{ module: "study", target: 120, status: "done", value: 30 }],
    week: { studyRate: 0.7, growthScore: 78 },
  });
  assert.doesNotMatch(JSON.stringify(context), /user-1|private|secret|proof-1|file\.jpg|entry-id|9999|123|42|arbitrary/i);
});

test("duo reflection applies the personal minimizer to both partners", () => {
  const context = buildDuoReflectionContext({
    you: { goals: { taskTarget: 4, arbitraryNumeric: 55 }, today: [{ module: "tasks", target: 4, status: "done", proof_id: "you-proof", id: "you-id" }], week: { growthScore: 80, name: "Sreya" } },
    partner: { goals: { taskTarget: 5, arbitraryNumeric: 66 }, today: [{ module: "tasks", target: 5, status: "pending", detail_json: "raw", file_path: "/partner.jpg", user_id: "partner-id" }], week: { growthScore: 70, name: "Sai" } },
    duoName: "Sreya and Sai",
  });

  assert.deepEqual(Object.keys(context).sort(), ["partner", "you"]);
  assert.deepEqual(context.you, { goals: { taskTarget: 4 }, today: [{ module: "tasks", target: 4, status: "done", value: null }], week: { growthScore: 80 } });
  assert.deepEqual(context.partner, { goals: { taskTarget: 5 }, today: [{ module: "tasks", target: 5, status: "pending", value: null }], week: { growthScore: 70 } });
  assert.doesNotMatch(JSON.stringify(context), /Sreya|Sai|proof|raw|partner\.jpg|partner-id|you-id|55|66/i);
});

test("Insight Explain sends only numeric signals even when its narrative source contains names", async () => {
  const insight = buildInsightsExplainContext({
    growthScore: 82,
    subscores: { discipline: 80, mind: 82, health: 70, consistency: 90, private: 999 },
    prediction: { behavior: "remind Sai to start", riskPercent: 40, reason: "Sreya missed two late starts", forUser: "Ada", proof_id: "proof-1" },
    suggestion: "Ask Sai to start early", strength: "Sreya has consistent wakeups", weeklyVerdict: "Sreya and Sai had a solid week",
    proof: { file_path: "/private.jpg" }, userId: "user-1",
  });
  assert.deepEqual(insight, {
    growthScore: 82,
    subscores: { discipline: 80, mind: 82, health: 70, consistency: 90 },
    riskPercent: 40,
  });
  assert.doesNotMatch(JSON.stringify(insight), /Ada|Sai|Sreya|proof|private|user-1|999/i);
});

test("POTD tutoring accepts only its dedicated server-derived allow-list", async () => {
  const contextModule = await import("./context.js") as typeof import("./context.js") & {
    buildPotdTutorContext?: (value: Record<string, unknown>) => unknown;
  };
  assert.equal(typeof contextModule.buildPotdTutorContext, "function");

  const tutor = contextModule.buildPotdTutorContext!({
    title: "Two sum", body: "Find the pair.", topic: "Arrays", difficulty: "easy", id: "q-1", source: "Private bank", proof_id: "proof-2", answer: "secret",
  });
  assert.deepEqual(tutor, { assignment: { title: "Two sum", body: "Find the pair.", topic: "Arrays", difficulty: "easy" } });
  assert.doesNotMatch(JSON.stringify(tutor), /q-1|Private bank|proof|secret/i);
});
