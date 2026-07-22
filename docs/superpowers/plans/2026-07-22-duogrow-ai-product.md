# DuoGrow AI Product Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a privacy-first, user-facing DuoGrow AI platform delivering Daily Coach, mutual-consent Duo Reflection, POTD Tutor, and ephemeral Coach Chat.

**Architecture:** The server owns all OpenAI access, consent, limits, minimized context, and deterministic fallback behavior. The SPA exposes a single accessible Coach sheet and Profile privacy controls; the existing AI verification seam remains independent. A security foundation protects proof media and stores only hashes of bearer sessions before the new AI endpoints are exposed.

**Tech Stack:** Hono, TypeScript, better-sqlite3, Node `crypto` and `fetch`, OpenAI Responses API, React 19, Vitest/Testing Library, `tsx --test`.

## Global Constraints

- Keep `OPENAI_API_KEY` server-only; never return, persist, commit, or expose it.
- Send text-only minimized contexts to OpenAI with explicit model `gpt-5-mini`, `store: false`, no tools, no background mode, and bounded output.
- Do not send proof media, file paths, session tokens, IDs, invite codes, arbitrary module details, cheer text, or partner names to the coaching provider.
- AI is read-only: it cannot update goals, modules, proofs, tasks, or partner data.
- Personal AI starts off; Duo Reflection requires current opt-in from both duo members; revocation blocks new requests immediately.
- Chats have no database transcript. Persist only consent, non-content audit events, and daily estimated usage.
- Defaults are 3 Daily Coach, 5 Tutor, and 10 Chat calls/user/day, 1 Duo Reflection/duo/week, $0.03/user/day, and $25/project/month.
- Existing Anthropic proof verification stays independent; local no-key execution returns a clearly labelled deterministic demo result.
- All proof media delivery must be authorized by duo membership through an authenticated API endpoint; `/uploads/:name` is removed.
- Do not reset, seed, stop processes, push, deploy, or mutate existing user data automatically.

---

### Task 1: Secure sessions and proof-media delivery

**Files:**
- Create: `server/src/lib/session.ts`, `server/src/lib/session.test.ts`
- Modify: `server/src/db.ts`, `server/src/types.ts`, `server/src/lib/authMiddleware.ts`, `server/src/routes/auth.ts`, `server/src/routes/proofs.ts`, `server/src/index.ts`, `server/package.json`, `package.json`
- Create: `web/src/hooks/usePrivateProofUrl.ts`
- Modify: `web/src/api/client.ts`, `web/src/screens/VerifyResult.tsx`

**Consumes:** Existing `x-session` client header and proof `file_path` database column.

**Produces:** Hashed persisted sessions, `GET /api/proofs/:id/file`, and authenticated browser object URLs.

- [ ] **Step 1: Write failing server tests for session hashing and proof authorization**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { hashSessionToken } from "./session.js";

test("hashSessionToken is deterministic but does not return the bearer value", () => {
  const token = "session-secret";
  assert.equal(hashSessionToken(token), hashSessionToken(token));
  assert.notEqual(hashSessionToken(token), token);
});
```

Add a route test that creates two duos, authenticates as each, and expects a
foreign `GET /api/proofs/:id/file` request to return 404.

- [ ] **Step 2: Run the new tests and confirm the missing interfaces fail**

Run: `npm --prefix server run test -- session.test.ts`

Expected: FAIL because `session.ts`, the server test script, and private media
route do not exist.

- [ ] **Step 3: Add the migration-safe session and media implementation**

```ts
// server/src/lib/session.ts
import { createHash, randomBytes } from "node:crypto";

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
```

Add `session_token_hash` with an idempotent `PRAGMA table_info`/`ALTER TABLE`
helper. Migrate a legacy token to its hash during startup, query only the hash
in authentication, and return newly generated random tokens from login/register.
Add `GET /api/proofs/:id/file`; select the proof by id and current `duo_id`,
validate the resolved path remains beneath `UPLOADS_DIR`, and stream only that
file. Replace `/uploads/:name` with a 404. Add `api.proofFile(id)` that fetches
with `authHeaders`, returns a `Blob`, and have `usePrivateProofUrl` revoke its
object URL when the proof changes or the component unmounts.

- [ ] **Step 4: Make the tests pass and run the existing web proof tests**

Run: `npm --prefix server run test && npm --prefix web run test -- VerifyResult`

Expected: server hash/authorization tests and existing proof rendering tests pass.

- [ ] **Step 5: Commit the security foundation**

```powershell
git add server/src web/src package.json server/package.json
git commit -m "fix: secure sessions and proof media"
```

### Task 2: Add durable AI policy, consent, and budget primitives

**Files:**
- Create: `server/src/lib/ai/types.ts`, `server/src/lib/ai/policy.ts`, `server/src/lib/ai/limits.ts`, `server/src/lib/ai/context.ts`
- Test: `server/src/lib/ai/policy.test.ts`, `server/src/lib/ai/limits.test.ts`, `server/src/lib/ai/context.test.ts`
- Modify: `server/src/db.ts`, `server/src/types.ts`

**Consumes:** Authenticated `UserRow`, duo membership, current-day rows, and weekly statistics.

**Produces:** Typed consent state, minimized contexts, atomic request reservation, and no-content audit records.

- [ ] **Step 1: Write failing privacy and budget tests**

```ts
test("personal context omits free text, identifiers, proof paths, and partner data", () => {
  const context = buildDailyCoachContext(fixture);
  assert.deepEqual(Object.keys(context), ["goals", "today", "week"]);
  assert.equal(JSON.stringify(context).includes("secret-detail"), false);
});

test("Duo Reflection is denied until both active members consent", () => {
  assert.equal(canUseDuoReflection([{ enabled: true }, { enabled: false }]), false);
});
```

Add tests that a cap returns `AiLimitError`, only a successful reservation
increments counters, and deleting AI data removes consent/audit/usage records
without touching tasks, proofs, or modules.

- [ ] **Step 2: Run the test files and confirm they fail before implementation**

Run: `npm --prefix server run test -- policy.test.ts limits.test.ts context.test.ts`

Expected: FAIL because the `lib/ai` modules and AI tables do not exist.

- [ ] **Step 3: Implement policy tables, minimized contexts, and atomic limits**

```ts
export type AiFeature = "daily_plan" | "duo_reflection" | "potd_tutor" | "chat";
export type AiMode = "live" | "demo" | "disabled";

export interface AiSettings {
  personalEnabled: boolean;
  duoEnabled: boolean;
  policyVersion: string;
  mode: AiMode;
  usage: Record<AiFeature, { remaining: number; estimatedCostCents: number }>;
}
```

Create the five tables specified in the design. Use transactions to check and
reserve both user and monthly project limits. Only accept a feature after
personal consent, and require all current duo members to have enabled
`ai_duo_consents` for a reflection. Build contexts from numeric module state,
configured targets, and aggregate weekly metrics only. Use `you`/`partner`
labels for reflection. Write audit rows containing event type/feature/policy
version/timestamp only.

- [ ] **Step 4: Run focused server tests and inspect the SQL invariants**

Run: `npm --prefix server run test -- policy.test.ts limits.test.ts context.test.ts`

Expected: PASS; assertions prove consent revocation, aggregate-only context,
rollback, quota, and deletion behavior.

- [ ] **Step 5: Commit the AI policy core**

```powershell
git add server/src/db.ts server/src/types.ts server/src/lib/ai
git commit -m "feat: add AI consent and budget controls"
```

### Task 3: Implement live and deterministic AI providers

**Files:**
- Create: `server/src/lib/ai/provider.ts`, `server/src/lib/ai/openAiProvider.ts`, `server/src/lib/ai/demoAiProvider.ts`, `server/src/lib/ai/prompts.ts`
- Test: `server/src/lib/ai/openAiProvider.test.ts`, `server/src/lib/ai/demoAiProvider.test.ts`

**Consumes:** An `AiFeature`, minimized context, optional bounded user message, and `OPENAI_API_KEY`.

**Produces:** `{ text, mode, inputTokens?, outputTokens? }` with reliable
fallback and no provider-side state.

- [ ] **Step 1: Write failing provider tests using mocked `fetch`**

```ts
test("OpenAI request is text-only, bounded, and disables stored responses", async () => {
  const request = await capturedRequest(runLiveProvider);
  assert.equal(request.model, "gpt-5-mini");
  assert.equal(request.store, false);
  assert.equal(request.tools, undefined);
  assert.ok(request.max_output_tokens <= 700);
});

test("missing credential returns a labelled deterministic demo result", async () => {
  assert.equal((await providerWithoutKey.generate(input)).mode, "demo");
});
```

- [ ] **Step 2: Run provider tests and confirm the provider is absent**

Run: `npm --prefix server run test -- openAiProvider.test.ts demoAiProvider.test.ts`

Expected: FAIL because provider modules do not exist.

- [ ] **Step 3: Implement the provider seam and feature prompts**

```ts
export interface AiProvider {
  generate(input: AiGenerationInput): Promise<AiGenerationResult>;
}

export interface AiGenerationResult {
  text: string;
  mode: "live" | "demo";
  inputTokens?: number;
  outputTokens?: number;
}
```

Use server `fetch` with a 12-second `AbortSignal.timeout`, `Authorization:
Bearer ${OPENAI_API_KEY}`, `/v1/responses`, explicit `gpt-5-mini`, `store:
false`, text-only developer/user messages, and a maximum of 700 output tokens.
Extract only `output_text`; reject empty/oversized output. Prompts enforce each
feature's read-only scope, short answer shape, no proof/media request, no
medical diagnosis, and POTD progressive-hint policy. On key absence, timeout,
non-OK response, or malformed output, generate feature-specific deterministic
copy with `mode: "demo"` and no misleading success label.

- [ ] **Step 4: Run provider tests and static checks**

Run: `npm --prefix server run test -- openAiProvider.test.ts demoAiProvider.test.ts; npm --prefix server run typecheck`

Expected: PASS; a secret value never appears in test snapshots or output.

- [ ] **Step 5: Commit the provider seam**

```powershell
git add server/src/lib/ai
git commit -m "feat: add OpenAI coaching provider"
```

### Task 4: Expose authenticated AI endpoints

**Files:**
- Create: `server/src/routes/ai.ts`, `server/src/routes/ai.test.ts`
- Modify: `server/src/index.ts`, `server/src/honoEnv.ts`

**Consumes:** AI policy/limits/context/provider modules and existing session auth.

**Produces:** Settings, consent, deletion, and four read-only feature endpoints.

- [ ] **Step 1: Write route tests for every authorization boundary**

```ts
test("POST /api/ai/daily-plan returns 403 without personal consent", async () => {
  const response = await app.request("/api/ai/daily-plan", { headers: sessionHeaders(user) });
  assert.equal(response.status, 403);
});

test("POST /api/ai/chat rejects messages longer than 500 characters", async () => {
  const response = await postAs(user, "/api/ai/chat", { message: "x".repeat(501) });
  assert.equal(response.status, 400);
});
```

Cover all four successful demo responses, mutual duo denial, revocation,
`429` quota response, provider rollback, settings deletion, and exact no-chat
storage behavior.

- [ ] **Step 2: Run route tests and confirm the new API is missing**

Run: `npm --prefix server run test -- ai.test.ts`

Expected: FAIL because `/api/ai` is not registered.

- [ ] **Step 3: Implement `aiRoutes` with strict payload validation**

```ts
aiRoutes.get("/settings", async (c) => c.json(await getAiSettings(c.get("user"))));
aiRoutes.put("/settings", async (c) => c.json(await setPersonalConsent(c.get("user"), await c.req.json())));
aiRoutes.put("/duo-consent", async (c) => c.json(await setDuoConsent(c.get("user"), await c.req.json())));
aiRoutes.delete("/data", async (c) => c.json(await deleteAiData(c.get("user"))));
```

Register `/api/ai`, validate object payloads before reading fields, and route
each generation through one `runAiFeature` service that checks consent, reserves
limits, builds context, calls the provider, finalizes/rolls back usage, and
returns `text`, `mode`, `remaining`, and no prompt body. Use 400 for malformed
input, 403 for consent, 404 for unavailable duo, 429 for caps, and 503 only
when no safe result can be returned.

- [ ] **Step 4: Run the server suite and confirm no API regression**

Run: `npm --prefix server run test && npm --prefix server run typecheck`

Expected: PASS; existing routes retain their current behavior.

- [ ] **Step 5: Commit the backend API**

```powershell
git add server/src/routes/ai.ts server/src/routes/ai.test.ts server/src/index.ts server/src/honoEnv.ts
git commit -m "feat: add privacy-first AI API"
```

### Task 5: Add typed client support and accessible reusable AI UI

**Files:**
- Create: `web/src/components/AiCoachSheet.tsx`, `web/src/components/AiCoachSheet.test.tsx`, `web/src/components/ai-coach-sheet.css`, `web/src/components/AiPrivacyPanel.tsx`, `web/src/components/AiPrivacyPanel.test.tsx`, `web/src/components/ai-privacy-panel.css`
- Modify: `web/src/api/types.ts`, `web/src/api/client.ts`

**Consumes:** `/api/ai` settings and generation response contracts.

**Produces:** Typed requests plus an accessible consent/generation sheet and
privacy panel that never claims demo output is live.

- [ ] **Step 1: Write failing component tests for consent and modes**

```tsx
it("blocks a generation until personal consent is saved", async () => {
  render(<AiCoachSheet open mode="daily_plan" settings={disabled} onClose={vi.fn()} />);
  expect(screen.getByRole("button", { name: "Enable personal AI" })).toBeVisible();
  expect(api.dailyPlan).not.toHaveBeenCalled();
});

it("labels a fallback reply as Demo coaching", async () => {
  mockGeneration({ text: "Try one focused step.", mode: "demo", remaining: 2 });
  render(<AiCoachSheet open mode="daily_plan" settings={enabled} onClose={vi.fn()} />);
  expect(await screen.findByText("Demo coaching")).toBeVisible();
});
```

Test dialog focus, Escape, background inertness, loading/error/retry, 429 copy,
the 500-character limit, and no full-solution Tutor wording.

- [ ] **Step 2: Run component tests and confirm imports fail first**

Run: `npm --prefix web run test -- AiCoachSheet AiPrivacyPanel`

Expected: FAIL because the client contracts and components do not exist.

- [ ] **Step 3: Implement client contracts and reusable components**

```ts
export interface AiGenerationResponse {
  text: string;
  mode: "live" | "demo";
  remaining: number;
  estimatedCostCents: number;
}

export interface AiSettingsResponse {
  personalEnabled: boolean;
  duoEnabled: boolean;
  mode: "live" | "demo" | "disabled";
  usage: Record<AiFeature, AiUsage>;
}
```

Add typed `api.aiSettings`, `api.updateAiSettings`, `api.updateAiDuoConsent`,
`api.deleteAiData`, `api.dailyPlan`, `api.duoReflection`, `api.potdTutor`, and
`api.aiChat` wrappers. Build the sheet with the proven `MealLogSheet` dialog
contract: labelled modal, focus trap, Escape/backdrop close, safe focus return,
and a polite status live region. Make the consent copy specific about aggregates,
partner consent, no proof media, retention controls, daily budget, and demo mode.
The privacy panel exposes enabled/revoked states, usage, mutual consent, and a
confirmation step before deletion.

- [ ] **Step 4: Run focused UI tests and lint**

Run: `npm --prefix web run test -- AiCoachSheet AiPrivacyPanel; npm --prefix web run lint`

Expected: PASS with no accessibility regression.

- [ ] **Step 5: Commit shared AI UI**

```powershell
git add web/src/api web/src/components
git commit -m "feat: add DuoGrow AI controls"
```

### Task 6: Wire all four product experiences into the existing screens

**Files:**
- Modify: `web/src/screens/Today.tsx`, `web/src/screens/Today.test.tsx`, `web/src/screens/Insights.tsx`, `web/src/screens/Insights.test.tsx`, `web/src/screens/Potd.tsx`, `web/src/screens/Potd.test.tsx`, `web/src/screens/Profile.tsx`, `web/src/screens/Profile.test.tsx`, `web/src/screens/VerifyResult.tsx`

**Consumes:** `AiCoachSheet`, `AiPrivacyPanel`, current screen data, and typed API wrappers.

**Produces:** All four discoverable AI experiences without a new navigation tab.

- [ ] **Step 1: Write failing screen tests for contextual launchers**

```tsx
it("opens Daily Coach from the Today Coach card", async () => {
  renderToday();
  await userEvent.click(await screen.findByRole("button", { name: "Ask DuoGrow AI" }));
  expect(screen.getByRole("dialog", { name: "DuoGrow AI" })).toBeVisible();
});

it("keeps shared reflection unavailable until mutual consent", async () => {
  render(<Profile />);
  expect(await screen.findByText("Partner consent required")).toBeVisible();
});
```

Cover Insights Explain/Plan, POTD Tutor, Chat, Profile consent/deletion, and
Verify Result's rule that it cannot attach proof media.

- [ ] **Step 2: Run screen tests and confirm the launchers are absent**

Run: `npm --prefix web run test -- Today Insights Potd Profile VerifyResult`

Expected: FAIL for each new visible control.

- [ ] **Step 3: Wire contextual modes with local sheet state**

Use local screen state instead of global AI chat state. Today passes
`daily_plan`/`chat`; Insights passes `daily_plan` with its selected explanation;
POTD passes `potd_tutor`; Profile renders `AiPrivacyPanel` and a Duo Reflection
launcher only when both consents are true. Verify Result may open Daily Coach
but never passes proof fields or file URLs. Preserve the five-control tab bar.

- [ ] **Step 4: Run all web tests and build the SPA**

Run: `npm --prefix web run test && npm --prefix web run build`

Expected: PASS; the production bundle builds and the AI surface remains usable
at the project phone viewport.

- [ ] **Step 5: Commit screen integration**

```powershell
git add web/src/screens
git commit -m "feat: surface DuoGrow AI experiences"
```

### Task 7: Document deployment, privacy, and final verification

**Files:**
- Create: `docs/duogrow-ai.md`
- Modify: `AGENTS.md`, `HANDOVER.md`, `SPEC.md`, `.env.example` (if absent)
- Test: `server/src/routes/ai.test.ts`, `web/src/components/AiCoachSheet.test.tsx`

**Consumes:** Complete server and SPA behavior.

**Produces:** Honest operations guidance, deployment configuration, and final
evidence for all privacy/cost claims.

- [ ] **Step 1: Write documentation assertions into tests and a two-session smoke script**

Add a server test that a revoked user receives 403, another that a single
partner receives 403 for reflection, and a production smoke command that proves
the no-key response declares `mode: "demo"`. Assert public `/uploads/:name`
returns 404 and authenticated `/api/proofs/:id/file` enforces duo membership.

- [ ] **Step 2: Run those verification tests before documentation**

Run: `npm --prefix server run test && npm --prefix web run test`

Expected: PASS; if a claim is not provable by a test, correct the product/docs
instead of claiming it.

- [ ] **Step 3: Document exact deployment and privacy controls**

Document `OPENAI_API_KEY`, every budget variable, server-only key requirement,
`store: false`, provider abuse-monitoring disclosure, optional OpenAI ZDR/MAM,
project spend alerts, consent/revocation/deletion behavior, demo fallback, and
the no-proof-media coaching boundary. Add an `.env.example` with names only,
never secret values. Update the product spec with the new capabilities and
explicitly retain the original verifier's Anthropic configuration.

- [ ] **Step 4: Run the complete production-quality verification**

Run: `npm run verify && npm --prefix server run test && npm run harness:doctor && git diff --check && git status --short`

Expected: web tests, server tests, typecheck, lint, build, harness doctor, and
whitespace checks pass; only intentional tracked changes remain before commit.

- [ ] **Step 5: Commit product documentation and verification evidence**

```powershell
git add docs AGENTS.md HANDOVER.md SPEC.md .env.example
git commit -m "docs: document DuoGrow AI operations"
```

