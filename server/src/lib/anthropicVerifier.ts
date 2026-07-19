import Anthropic from "@anthropic-ai/sdk";
import { readFile } from "node:fs/promises";
import { DemoVerifier } from "./demoVerifier.js";
import { EXTRACT_SCHEMA, INSIGHTS_SCHEMA, VERDICT_SCHEMA } from "./verifierSchemas.js";
import { EXTRACT_SYSTEM_PROMPT, INSIGHTS_SYSTEM_PROMPT, PROOF_SYSTEM_PROMPT } from "./verifierPrompts.js";
import type {
  ExtractInput,
  ExtractedQuestion,
  ExtractResult,
  InsightsNarrative,
  Verdict,
  Verifier,
  VerifyInput,
  WeeklyStats,
} from "./verifierTypes.js";

const DEFAULT_PROOF_MODEL = "claude-opus-4-8";
const DEFAULT_INSIGHTS_MODEL = "claude-haiku-4-5";
const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Live verifier backed by the Anthropic Messages API with structured outputs
 * (output_config.format = json_schema). No temperature/top_p/top_k, no
 * `thinking` — per SPEC.md these are unset/unsupported for the models used
 * here. Every call is wrapped so a failure degrades to DemoVerifier rather
 * than crashing the request.
 */
export class AnthropicVerifier implements Verifier {
  private client: Anthropic;
  private proofModel: string;
  private insightsModel: string;
  private fallback = new DemoVerifier();

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey, maxRetries: 3 });
    this.proofModel = process.env.PROOF_MODEL || DEFAULT_PROOF_MODEL;
    this.insightsModel = process.env.INSIGHTS_MODEL || DEFAULT_INSIGHTS_MODEL;
  }

  async verify(input: VerifyInput): Promise<Verdict> {
    try {
      return await this.callVerify(input);
    } catch {
      const demo = await this.fallback.verify(input);
      return {
        ...demo,
        band: "medium",
        coach_message: `AI verification was unavailable just now, so this needs your confirm. ${demo.coach_message}`,
      };
    }
  }

  private async callVerify(input: VerifyInput): Promise<Verdict> {
    const bytes = await readFile(input.filePath);
    const base64 = bytes.toString("base64");
    const proofBlock = toContentBlock(input.mimeType, base64);
    const contextText = JSON.stringify({ ...input.todayContext, moduleHint: input.moduleHint });

    const message = await this.client.messages.create({
      model: this.proofModel,
      max_tokens: 2048,
      system: [{ type: "text", text: PROOF_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      output_config: { format: { type: "json_schema", schema: VERDICT_SCHEMA } },
      messages: [
        {
          role: "user",
          content: [proofBlock, { type: "text", text: `TODAY CONTEXT:\n${contextText}\n\nVerify this proof.` }],
        },
      ],
    });

    return parseJsonBlock<Verdict>(message);
  }

  async extractQuestions(input: ExtractInput): Promise<ExtractResult> {
    const bytes = await readFile(input.filePath);
    const base64 = bytes.toString("base64");

    const message = await this.client.messages.create({
      model: this.proofModel,
      max_tokens: 8000,
      system: [{ type: "text", text: EXTRACT_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      output_config: { format: { type: "json_schema", schema: EXTRACT_SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
            {
              type: "text",
              text: `Extract all practice problems from this document. Source name: '${input.sourceName}'.`,
            },
          ],
        },
      ],
    });

    const parsed = parseJsonBlock<{ source_title: string | null; questions: ExtractedQuestion[] }>(message);
    return { sourceTitle: parsed.source_title, questions: parsed.questions };
  }

  async insights(stats: WeeklyStats): Promise<InsightsNarrative> {
    try {
      const message = await this.client.messages.create({
        model: this.insightsModel,
        max_tokens: 1024,
        system: [{ type: "text", text: INSIGHTS_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        output_config: { format: { type: "json_schema", schema: INSIGHTS_SCHEMA } },
        messages: [{ role: "user", content: JSON.stringify(stats) }],
      });
      return parseJsonBlock<InsightsNarrative>(message);
    } catch {
      return this.fallback.insights(stats);
    }
  }
}

function toContentBlock(mimeType: string, base64: string): Anthropic.ImageBlockParam | Anthropic.DocumentBlockParam {
  if (mimeType === "application/pdf") {
    return { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } };
  }
  const mediaType = IMAGE_MIME_TYPES.has(mimeType) ? (mimeType as "image/jpeg" | "image/png" | "image/webp") : "image/jpeg";
  return { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } };
}

function parseJsonBlock<T>(message: Anthropic.Message): T {
  const block = message.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  if (!block) throw new Error("Anthropic response had no text content block");
  return JSON.parse(block.text) as T;
}
