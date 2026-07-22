export interface AiRuntimeConfig {
  readonly openAiModel: string;
  readonly userDailyBudgetCents: number;
  readonly projectMonthlyBudgetCents: number;
  readonly dailyCallsPerUser: number;
  readonly tutorCallsPerUser: number;
  readonly chatCallsPerUser: number;
  readonly reflectionsPerDuoPerWeek: number;
}

export type AiEnvironment = Readonly<Record<string, string | undefined>>;

export const DEFAULT_AI_RUNTIME_CONFIG: AiRuntimeConfig = Object.freeze({
  openAiModel: "gpt-5-mini",
  userDailyBudgetCents: 3,
  projectMonthlyBudgetCents: 2500,
  dailyCallsPerUser: 3,
  tutorCallsPerUser: 5,
  chatCallsPerUser: 10,
  reflectionsPerDuoPerWeek: 1,
});

const SAFE_MODEL_NAME = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

/**
 * Reads server-only AI configuration. Invalid values safely retain their
 * conservative defaults, so a malformed deployment variable cannot disable
 * budget enforcement or broaden a feature quota.
 */
export function getAiRuntimeConfig(environment: AiEnvironment = process.env): AiRuntimeConfig {
  return Object.freeze({
    openAiModel: readModel(environment.OPENAI_MODEL),
    userDailyBudgetCents: readPositiveInteger(environment.AI_USER_DAILY_BUDGET_CENTS, DEFAULT_AI_RUNTIME_CONFIG.userDailyBudgetCents),
    projectMonthlyBudgetCents: readPositiveInteger(environment.AI_PROJECT_MONTHLY_BUDGET_CENTS, DEFAULT_AI_RUNTIME_CONFIG.projectMonthlyBudgetCents),
    dailyCallsPerUser: readPositiveInteger(environment.AI_DAILY_CALLS_PER_USER, DEFAULT_AI_RUNTIME_CONFIG.dailyCallsPerUser),
    tutorCallsPerUser: readPositiveInteger(environment.AI_TUTOR_CALLS_PER_USER, DEFAULT_AI_RUNTIME_CONFIG.tutorCallsPerUser),
    chatCallsPerUser: readPositiveInteger(environment.AI_CHAT_CALLS_PER_USER, DEFAULT_AI_RUNTIME_CONFIG.chatCallsPerUser),
    reflectionsPerDuoPerWeek: readPositiveInteger(environment.AI_REFLECTIONS_PER_DUO_PER_WEEK, DEFAULT_AI_RUNTIME_CONFIG.reflectionsPerDuoPerWeek),
  });
}

function readModel(value: string | undefined): string {
  const model = value?.trim();
  return model && SAFE_MODEL_NAME.test(model) ? model : DEFAULT_AI_RUNTIME_CONFIG.openAiModel;
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  const normalized = value?.trim();
  if (!normalized || !/^[1-9]\d*$/.test(normalized)) return fallback;
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) ? parsed : fallback;
}
