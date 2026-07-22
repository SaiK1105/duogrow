# DuoGrow AI Product Design

## Decision

Ship all four user-facing AI experiences on one privacy-first platform:

1. Daily Coach
2. Mutual-consent Duo Reflection
3. POTD Tutor
4. Ephemeral Coach Chat

The product is branded **DuoGrow AI**. It is not branded Codex because it does
not execute code, operate the application, or act autonomously.

## Product goals

- Give an accountable user a useful, bounded next step at the moment they need it.
- Let two partners reflect together only after both have independently opted in.
- Help with coding practice through progressive hints, not answer delivery.
- Let a user ask a short coaching question without creating a permanent chat record.
- Make data sharing, usage limits, provider availability, and withdrawal obvious.

## Non-goals

- The AI never writes tasks, goals, progress, proof verdicts, or partner data.
- General coaching and chat never receive proof images, PDFs, file paths, session
  tokens, IDs, invite codes, raw task details, or cheer text.
- There is no browser-side API key, hidden streaming connection, stored chat
  history, code execution, web search, external tool call, or medical/dietary
  diagnosis.
- Existing proof verification stays on its current provider seam. This feature
  adds a separate OpenAI-backed coaching seam rather than replacing verification.

## UX

### Entry points

- The Today Coach card gains an **Ask DuoGrow AI** action that opens an accessible
  sheet. The sheet has four explicit modes: Today's plan, Explain insight, POTD
  hint, and Ask a question.
- Insights gains Explain this and Make a plan actions that pass only the visible,
  minimized insight context.
- POTD gains a Tutor action. Its progressive hints are explanatory and never
  provide a complete solution or submit work.
- Profile gains **AI & privacy**. It shows personal consent, mutual duo consent,
  feature usage remaining, live/demo/disabled status, deletion, and revocation.

### Consent and withdrawal

- AI is off by default.
- First personal use requires an explicit personal-coaching consent. The sheet
  explains the exact categories sent: the user's configured goals, completion
  state, and seven-day aggregates. It excludes raw free-form details and proof
  media.
- Duo Reflection requires both partners to opt in independently. The AI sees
  role-labelled aggregate progress only ("you" and "partner"), not a partner's
  name, raw task content, proof, or messages.
- Either user can revoke personal or duo consent at any time. Revocation prevents
  subsequent provider calls immediately. Deleting AI data removes settings,
  consent/audit records, and estimated usage records; chats are already
  ephemeral and are not stored.

### Experience behavior

- Daily Coach returns a concise plan with no more than three actions and one
  encouragement.
- Duo Reflection returns a shared summary, one celebration, and one concrete
  mutual next step.
- POTD Tutor returns one progressively useful hint, a conceptual explanation,
  and a check-your-thinking question; it is explicitly not a solution service.
- Coach Chat accepts one message of at most 500 characters, passes it with a
  minimized personal snapshot, and returns a coaching answer. The browser keeps
  only the current open-sheet exchange.

## Privacy and security foundation

Before enabling any new feature, fix the existing media/session boundaries:

- Replace publicly streamed `/uploads/:name` proof access with an authenticated
  proof-file endpoint that checks the current user's duo before returning bytes.
  The web client fetches the file with `x-session` and renders a local object URL.
- Store a one-way hash of every session token in SQLite rather than the bearer
  token itself. Existing demo data is migrated on startup and new tokens are
  only returned once at authentication time.
- Use additive, idempotent schema migration helpers for new tables/columns; do
  not reset user data.
- Persist only consent/audit metadata and daily estimated token/cost usage. Do
  not persist chat content or OpenAI response text.
- Record audit events without prompt/response body: event type, actor, duo,
  policy version, timestamp, and feature.

## OpenAI provider and credentials

- The server reads `OPENAI_API_KEY` only from the deployment environment. It is
  never returned by the API, sent to the client, written to a database, or
  committed.
- Use `POST /v1/responses` with the explicit `gpt-5-mini` model and
  `store: false`. Requests are text-only; background mode, tools, and persisted
  provider conversations are disabled.
- Every provider request has a server timeout, bounded output, a feature-specific
  system instruction, and a safe parse/failure path.
- When no key is configured or a live request fails, return a deterministic
  **demo** response with `mode: "demo"`. The UI must state that it is a local
  fallback, never a live AI result.
- Standard API processing can still have provider abuse-monitoring retention.
  The Profile disclosure explains this and deployment documentation describes
  eligible Zero Data Retention / Modified Abuse Monitoring controls. This app
  does not claim zero retention unless the OpenAI project is configured for it.

## Cost controls

Default deployment environment limits are:

- `AI_USER_DAILY_BUDGET_CENTS=3`
- `AI_PROJECT_MONTHLY_BUDGET_CENTS=2500`
- 3 Daily Coach calls/day/user
- 5 POTD Tutor calls/day/user
- 10 Coach Chat calls/day/user
- 1 Duo Reflection/week/duo

SQLite atomically reserves a feature call before the provider is invoked using
the configured worst-case estimated cost. It rolls the reservation back for a
provider failure. The response includes remaining calls and estimated spend so
the UI can communicate limits. The deployment guide also requires matching
OpenAI project spend alerts; application accounting is a circuit breaker, not
the billing source of truth.

## Data model

Create additive tables:

- `ai_preferences(user_id PRIMARY KEY, personal_enabled, policy_version,
  consented_at, revoked_at, updated_at)`
- `ai_duo_consents(duo_id, user_id, enabled, updated_at, PRIMARY KEY(duo_id,
  user_id))`
- `ai_usage_daily(user_id, date, feature, calls_used, estimated_cost_cents,
  PRIMARY KEY(user_id, date, feature))`
- `ai_project_usage_month(month, estimated_cost_cents PRIMARY KEY(month))`
- `ai_audit_events(id, user_id, duo_id, event_type, feature, policy_version,
  created_at)` with no prompt or response columns.

The side-effect-free context builders expose only the specific aggregate needed
for each feature. A request must pass personal consent and a feature limit;
Duo Reflection also requires an active duo and both consent records.

## API surface

- `GET /api/ai/settings`
- `PUT /api/ai/settings` — personal consent only
- `PUT /api/ai/duo-consent` — current user's mutual-sharing preference
- `DELETE /api/ai/data`
- `POST /api/ai/daily-plan`
- `POST /api/ai/duo-reflection`
- `POST /api/ai/potd-tutor`
- `POST /api/ai/chat`
- `GET /api/proofs/:id/file` — authenticated media delivery

All endpoints use existing session authentication. Mutation endpoints validate
exact JSON shapes, cap input sizes, and return clear 400/403/429/503 responses.

## Testing and verification

- Add server tests for token hashing, authenticated proof access, context
  minimization, consent/revocation, dual-consent enforcement, no stored chat,
  rate/cost limits, provider failure rollback, and demo/live mode labels.
- Add web tests for first-use consent, accessible sheet behavior, all four entry
  points, partner-reflection gating, usage exhaustion, privacy deletion, and
  live/demo/error states.
- Add a two-session smoke test that proves one user cannot fetch another duo's
  proof, and that one partner cannot invoke a shared reflection without mutual
  consent.
- Run `npm run verify`, server tests, and a production-server smoke test before
  completion. A live OpenAI call is only tested when a valid deployment key is
  supplied; the no-key demo flow is always tested locally.

