import assert from "node:assert/strict";
import test from "node:test";

import { getAiRuntimeConfig } from "./config.js";
import { OpenAiProvider } from "./openAiProvider.js";
import type { AiGenerationInput } from "./provider.js";

const input: AiGenerationInput = {
  feature: "daily_plan",
  context: { goals: { studyTargetMinutes: 120 }, today: [], week: { studyRate: 0.5 } },
  userMessage: "Help me focus today.",
};

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

test("OpenAI provider sends a stateless text-only bounded request", async () => {
  const secret = "sk-test-secret-must-not-leak";
  let captured: { url: string; init?: RequestInit } | undefined;
  const provider = new OpenAiProvider({
    apiKey: secret,
    fetchImpl: async (url, init) => {
      captured = { url: String(url), init };
      return response({
        output: [{ type: "message", content: [{ type: "output_text", text: "Choose a 25-minute study block now." }] }],
        usage: { input_tokens: 12, output_tokens: 8 },
      });
    },
  });

  const result = await provider.generate(input);

  assert.deepEqual(result, { text: "Choose a 25-minute study block now.", mode: "live", inputTokens: 12, outputTokens: 8 });
  assert.equal(captured?.url, "https://api.openai.com/v1/responses");
  assert.equal(captured?.init?.method, "POST");
  assert.equal(captured?.init?.headers instanceof Headers ? captured.init.headers.get("authorization") : undefined, `Bearer ${secret}`);
  const body = JSON.parse(String(captured?.init?.body)) as Record<string, unknown>;
  assert.equal(body.model, "gpt-5-mini");
  assert.equal(body.store, false);
  assert.equal(body.max_output_tokens, 700);
  assert.equal("tools" in body, false);
  assert.equal("background" in body, false);
  assert.equal("web_search" in body, false);
  const messages = body.input as Array<{ role: string; content: Array<{ type: string; text: string }> }>;
  assert.deepEqual(messages.map(({ role, content }) => ({ role, contentType: content[0]?.type })), [
    { role: "developer", contentType: "input_text" },
    { role: "user", contentType: "input_text" },
  ]);
  assert.match(messages[0].content[0].text, /read-only coaching/i);
  assert.match(messages[1].content[0].text, /Help me focus today/);
  assert.doesNotMatch(JSON.stringify({ result, body }), new RegExp(secret));
});

test("OpenAI provider propagates the validated configured model", async () => {
  let model: unknown;
  const provider = new OpenAiProvider({
    apiKey: "sk-valid",
    config: getAiRuntimeConfig({ OPENAI_MODEL: "gpt-5.1-mini" }),
    fetchImpl: async (_url, init) => {
      model = (JSON.parse(String(init?.body)) as { model?: unknown }).model;
      return response({ output: [{ type: "message", content: [{ type: "output_text", text: "Start with one task." }] }] });
    },
  });

  await provider.generate(input);

  assert.equal(model, "gpt-5.1-mini");
});

test("OpenAI provider falls back deterministically when key is absent or live output is unusable", async (t) => {
  const noKey = new OpenAiProvider({ apiKey: "" });
  assert.deepEqual(await noKey.generate(input), { text: "Pick one 25-minute study block and start it now.", mode: "demo" });

  const failures: Array<[string, typeof fetch]> = [
    ["malformed JSON", async () => new Response("{", { status: 200 })],
    ["empty output text", async () => response({ output: [{ type: "message", content: [{ type: "output_text", text: "   " }] }] }, 200)],
    ["missing or unsupported output content", async () => response({ output: [{ type: "message", content: [{ type: "refusal", refusal: "No" }] }] }, 200)],
    ["non-OK response", async () => response({ error: "nope" }, 500)],
    ["timeout abort", async () => { throw new DOMException("Timed out", "AbortError"); }],
  ];
  for (const [name, fetchImpl] of failures) {
    await t.test(`falls back after ${name}`, async () => {
      const provider = new OpenAiProvider({ apiKey: "sk-valid", fetchImpl });
      assert.deepEqual(await provider.generate(input), { text: "Pick one 25-minute study block and start it now.", mode: "demo" });
    });
  }
});
