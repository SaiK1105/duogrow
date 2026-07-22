import { DemoAiProvider } from "./demoAiProvider.js";
import { getAiRuntimeConfig, type AiRuntimeConfig } from "./config.js";
import { buildAiPrompt } from "./prompts.js";
import type { AiGenerationInput, AiGenerationResult, AiProvider } from "./provider.js";

const RESPONSES_URL = "https://api.openai.com/v1/responses";
const REQUEST_TIMEOUT_MS = 12_000;
const MAX_OUTPUT_TOKENS = 700;
const MAX_OUTPUT_CHARS = 4_000;

interface OpenAiResponse {
  output?: unknown;
  usage?: { input_tokens?: unknown; output_tokens?: unknown };
}

export interface OpenAiProviderOptions {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  config?: Pick<AiRuntimeConfig, "openAiModel">;
}

/** Stateless OpenAI text generation with a deterministic demo fallback. */
export class OpenAiProvider implements AiProvider {
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly fallback: AiProvider;
  private readonly model: string;

  constructor(options: OpenAiProviderOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.OPENAI_API_KEY?.trim() ?? "";
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.fallback = new DemoAiProvider();
    this.model = options.config?.openAiModel ?? getAiRuntimeConfig().openAiModel;
  }

  async generate(input: AiGenerationInput): Promise<AiGenerationResult> {
    if (!this.apiKey) return this.fallback.generate(input);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const prompt = buildAiPrompt(input);
        const result = await this.fetchImpl(RESPONSES_URL, {
          method: "POST",
          headers: new Headers({
            "authorization": `Bearer ${this.apiKey}`,
            "content-type": "application/json",
          }),
          body: JSON.stringify({
            model: this.model,
            store: false,
            max_output_tokens: MAX_OUTPUT_TOKENS,
            input: [
              { role: "developer", content: [{ type: "input_text", text: prompt.developer }] },
              { role: "user", content: [{ type: "input_text", text: prompt.user }] },
            ],
          }),
          signal: controller.signal,
        });
        if (!result.ok) return this.fallback.generate(input);
        return await this.extract(result, input);
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      return this.fallback.generate(input);
    }
  }

  private async extract(response: Response, input: AiGenerationInput): Promise<AiGenerationResult> {
    const body = await response.json() as OpenAiResponse;
    const text = extractOutputText(body.output);
    if (!text) return this.fallback.generate(input);
    return {
      text,
      mode: "live",
      inputTokens: numericUsage(body.usage?.input_tokens),
      outputTokens: numericUsage(body.usage?.output_tokens),
    };
  }
}

function extractOutputText(output: unknown): string | null {
  if (!Array.isArray(output)) return null;

  let text = "";
  for (const item of output) {
    if (!isRecord(item) || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (!isRecord(content) || content.type !== "output_text" || typeof content.text !== "string") continue;
      const next = content.text.trim();
      if (!next) continue;
      const separator = text ? "\n" : "";
      text += `${separator}${next}`;
      if (text.length >= MAX_OUTPUT_CHARS) return text.slice(0, MAX_OUTPUT_CHARS);
    }
  }
  return text || null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function numericUsage(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}
