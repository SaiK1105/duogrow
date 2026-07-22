import type { AiGenerationInput } from "./provider.js";

const MAX_USER_MESSAGE_CHARS = 500;
const MAX_CONTEXT_CHARS = 6_000;

const FEATURE_INSTRUCTIONS: Record<AiGenerationInput["feature"], string> = {
  daily_plan: "Offer one short, practical plan for today based only on the supplied numbers.",
  duo_reflection: "Offer one short shared reflection and a practical next step without ranking either person.",
  potd_tutor: "Give one progressive hint only. Do not provide a complete solution, code, or final answer.",
  chat: "Offer one short, action-oriented coaching response.",
};

export interface AiPrompt {
  developer: string;
  user: string;
}

/** Builds text-only, bounded messages from the already minimized Task 2 context. */
export function buildAiPrompt(input: AiGenerationInput): AiPrompt {
  const context = JSON.stringify(input.context).slice(0, MAX_CONTEXT_CHARS);
  const userMessage = input.userMessage?.trim().slice(0, MAX_USER_MESSAGE_CHARS) || "No additional request.";
  return {
    developer: [
      "You are DuoGrow's read-only coaching assistant.",
      "Use only the provided minimized context; do not claim to change app data.",
      "Keep copy short and action-oriented.",
      "Never request proof, photos, media, uploads, or personal identifiers.",
      "Do not give medical, nutrition, or diet diagnoses.",
      FEATURE_INSTRUCTIONS[input.feature],
    ].join(" "),
    user: `Context: ${context}\nRequest: ${userMessage}`,
  };
}
