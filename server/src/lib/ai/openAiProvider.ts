import { DemoAiProvider } from "./demoAiProvider.js";
import { buildAiPrompt } from "./prompts.js";
import type { AiGenerationInput, AiGenerationResult, AiProvider } from "./provider.js";

const RESPONSES_URL = "https://api.openai.com/v1/responses";
const REQUEST_TIMEOUT_MS = 12_000;
const MAX_OUTPUT_TOKENS = 700;
const MAX_OUTPUT_CHARS = 4_000;

interface OpenAiResponse {
  output_text?: unknown;
  usage?: { input_tokens?: unknown; output_tokens?: unknown };
}

export interface OpenAiProviderOptions {
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

/** Stateless OpenAI text generation with a deterministic demo fallback. */
export class OpenAiProvider implements AiProvider {
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly fallback: AiProvider;

  constructor(options: OpenAiProviderOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.OPENAI_API_KEY?.trim() ?? "";
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.fallback = new DemoAiProvider();
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
            model: "gpt-5-mini",
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
    if (typeof body.output_text !== "string") return this.fallback.generate(input);
    const text = body.output_text.trim().slice(0, MAX_OUTPUT_CHARS);
    if (!text) return this.fallback.generate(input);
    return {
      text,
      mode: "live",
      inputTokens: numericUsage(body.usage?.input_tokens),
      outputTokens: numericUsage(body.usage?.output_tokens),
    };
  }
}

function numericUsage(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}
