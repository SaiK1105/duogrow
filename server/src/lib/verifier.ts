import { AnthropicVerifier } from "./anthropicVerifier.js";
import { DemoVerifier } from "./demoVerifier.js";
import type { Verifier } from "./verifierTypes.js";

export * from "./verifierTypes.js";

/** True when a live ANTHROPIC_API_KEY is configured and DEMO_FAKE_AI hasn't forced demo mode. */
export function isLiveMode(): boolean {
  const key = process.env.ANTHROPIC_API_KEY;
  const forceDemo = process.env.DEMO_FAKE_AI === "1";
  return Boolean(key) && !forceDemo;
}

let cached: Verifier | null = null;

/** The active Verifier for this process — AnthropicVerifier when live, DemoVerifier otherwise. */
export function getVerifier(): Verifier {
  if (cached) return cached;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  cached = isLiveMode() && apiKey ? new AnthropicVerifier(apiKey) : new DemoVerifier();
  return cached;
}
