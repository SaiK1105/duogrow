import type { AiFeature } from "../../types.js";
import type { DuoReflectionContext, InsightsExplainContext, PersonalAiContext, PotdTutorContext } from "./context.js";

export interface AiGenerationInput {
  feature: AiFeature;
  context: PersonalAiContext | DuoReflectionContext | InsightsExplainContext | PotdTutorContext;
  userMessage?: string;
}

export interface AiProvider {
  generate(input: AiGenerationInput): Promise<AiGenerationResult>;
}

export interface AiGenerationResult {
  text: string;
  mode: "live" | "demo";
  inputTokens?: number;
  outputTokens?: number;
  /** Internal only: a keyed provider failure returned demo copy and must not consume a reservation. */
  rollbackReservation?: boolean;
}
