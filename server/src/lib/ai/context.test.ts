import assert from "node:assert/strict";
import test from "node:test";

import { buildDuoReflectionContext, buildPersonalAiContext } from "./context.js";

test("personal AI context contains only goals, today, and week", () => {
  const context = buildPersonalAiContext({
    goals: { studyMinutes: 120, taskCount: 4 },
    today: [{ module: "study", target: 120, status: "done", value: 30, detail_json: '{"secret":"no"}', proof_id: "proof-1" }],
    week: { completionRate: 0.7, growthScore: 78, userId: "user-1", name: "private" },
    arbitraryDetail: "must not cross the boundary",
  });

  assert.deepEqual(Object.keys(context).sort(), ["goals", "today", "week"]);
  assert.deepEqual(context, {
    goals: { studyMinutes: 120, taskCount: 4 },
    today: [{ module: "study", target: 120, status: "done", value: 30 }],
    week: { completionRate: 0.7, growthScore: 78 },
  });
  assert.doesNotMatch(JSON.stringify(context), /user-1|private|secret|proof-1|arbitrary/i);
});

test("duo reflection context labels people without names", () => {
  const context = buildDuoReflectionContext({
    you: { goals: { taskCount: 4 }, today: [], week: { growthScore: 80 } },
    partner: { goals: { taskCount: 5 }, today: [], week: { growthScore: 70 } },
    duoName: "Sreya and Sai",
  });

  assert.deepEqual(Object.keys(context).sort(), ["partner", "you"]);
  assert.doesNotMatch(JSON.stringify(context), /Sreya|Sai/);
});
