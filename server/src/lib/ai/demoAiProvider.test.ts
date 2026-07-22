import assert from "node:assert/strict";
import test from "node:test";

import { DemoAiProvider } from "./demoAiProvider.js";
import type { AiFeature } from "../../types.js";

test("demo provider returns deterministic feature-specific coaching", async () => {
  const provider = new DemoAiProvider();
  const features: AiFeature[] = ["daily_plan", "duo_reflection", "potd_tutor", "chat"];
  const results = await Promise.all(features.map((feature) => provider.generate({ feature, context: { goals: {}, today: [], week: {} } })));

  assert.deepEqual(results, [
    { text: "Pick one 25-minute study block and start it now.", mode: "demo" },
    { text: "Choose one shared win and one small next step together.", mode: "demo" },
    { text: "Start by naming the input, output, and one constraint.", mode: "demo" },
    { text: "Choose the smallest next action you can finish today.", mode: "demo" },
  ]);
});
