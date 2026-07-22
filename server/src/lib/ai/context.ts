/** Data accepted at the AI boundary. Extra fields are deliberately ignored. */
export interface PersonalAiContextInput {
  goals: Record<string, unknown>;
  today: Array<{ module: string; target: number | null; status: string; value?: number | null; [key: string]: unknown }>;
  week: Record<string, unknown>;
  [key: string]: unknown;
}

export interface PersonalAiContext {
  goals: Record<string, number>;
  today: Array<{ module: string; target: number | null; status: string; value: number | null }>;
  week: Record<string, number>;
}

export interface DuoReflectionContext {
  you: PersonalAiContext;
  partner: PersonalAiContext;
}

/** Creates a fresh, allow-listed view with no identifiers, prose, or raw rows. */
export function buildPersonalAiContext(input: PersonalAiContextInput): PersonalAiContext {
  return {
    goals: Object.fromEntries(Object.entries(input.goals).filter(([, value]) => typeof value === "number" && Number.isFinite(value))) as Record<string, number>,
    today: input.today.map((entry) => ({
      module: entry.module,
      target: entry.target,
      status: entry.status,
      value: entry.value ?? null,
    })),
    week: Object.fromEntries(Object.entries(input.week).filter(([, value]) => typeof value === "number" && Number.isFinite(value))) as Record<string, number>,
  };
}

/** Keeps the two minimised views positional: `you` and `partner`, never names. */
export function buildDuoReflectionContext(input: DuoReflectionContext & Record<string, unknown>): DuoReflectionContext {
  return {
    you: {
      goals: { ...input.you.goals },
      today: input.you.today.map((entry) => ({ ...entry })),
      week: { ...input.you.week },
    },
    partner: {
      goals: { ...input.partner.goals },
      today: input.partner.today.map((entry) => ({ ...entry })),
      week: { ...input.partner.week },
    },
  };
}
