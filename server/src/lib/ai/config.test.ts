import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_AI_RUNTIME_CONFIG, getAiRuntimeConfig } from "./config.js";

test("AI runtime configuration uses conservative production defaults", () => {
  assert.deepEqual(getAiRuntimeConfig({}), DEFAULT_AI_RUNTIME_CONFIG);
});

test("AI runtime configuration accepts safe environment overrides", () => {
  assert.deepEqual(getAiRuntimeConfig({
    OPENAI_MODEL: "gpt-5.1-mini",
    AI_USER_DAILY_BUDGET_CENTS: "4",
    AI_PROJECT_MONTHLY_BUDGET_CENTS: "3000",
    AI_DAILY_CALLS_PER_USER: "2",
    AI_TUTOR_CALLS_PER_USER: "6",
    AI_CHAT_CALLS_PER_USER: "12",
    AI_REFLECTIONS_PER_DUO_PER_WEEK: "2",
  }), {
    openAiModel: "gpt-5.1-mini",
    userDailyBudgetCents: 4,
    projectMonthlyBudgetCents: 3000,
    dailyCallsPerUser: 2,
    tutorCallsPerUser: 6,
    chatCallsPerUser: 12,
    reflectionsPerDuoPerWeek: 2,
  });
});

test("AI runtime configuration falls back for malformed or unsafe values", () => {
  assert.deepEqual(getAiRuntimeConfig({
    OPENAI_MODEL: "gpt-5 mini",
    AI_USER_DAILY_BUDGET_CENTS: "0",
    AI_PROJECT_MONTHLY_BUDGET_CENTS: "-1",
    AI_DAILY_CALLS_PER_USER: "1.5",
    AI_TUTOR_CALLS_PER_USER: "NaN",
    AI_CHAT_CALLS_PER_USER: "9007199254740992",
    AI_REFLECTIONS_PER_DUO_PER_WEEK: "",
  }), DEFAULT_AI_RUNTIME_CONFIG);
});
