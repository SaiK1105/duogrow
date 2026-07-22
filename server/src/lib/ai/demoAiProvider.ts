import type { AiGenerationInput, AiGenerationResult, AiProvider } from "./provider.js";

const DEMO_COPY: Record<AiGenerationInput["feature"], string> = {
  daily_plan: "Pick one 25-minute study block and start it now.",
  duo_reflection: "Choose one shared win and one small next step together.",
  potd_tutor: "Start by naming the input, output, and one constraint.",
  chat: "Choose the smallest next action you can finish today.",
};

/** A stable offline provider used whenever live generation is unavailable. */
export class DemoAiProvider implements AiProvider {
  async generate(input: AiGenerationInput): Promise<AiGenerationResult> {
    return { text: DEMO_COPY[input.feature], mode: "demo" };
  }
}
