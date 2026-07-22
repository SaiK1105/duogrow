import type { AiFeature } from "../../types.js";
import type { DuoReflectionContext, PersonalAiContext } from "./context.js";

export interface AiGenerationInput {
  feature: AiFeature;
  context: PersonalAiContext | DuoReflectionContext;
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
}
