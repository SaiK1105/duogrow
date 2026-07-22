# DuoGrow AI operations

DuoGrow has two separate AI products. They have different providers, inputs,
and operating controls:

- **Proof verification** is the existing Anthropic-backed verifier. It can read
  an uploaded proof when `ANTHROPIC_API_KEY` is configured, and it falls back to
  the deterministic `DemoVerifier` when no key is available or demo mode is
  forced.
- **DuoGrow AI coaching** provides a daily plan, an insight explanation, Duo
  Reflection, POTD tutoring, and short chat coaching. It is a server-only
  OpenAI integration. It never receives proof media or proof details.

## Deploying coaching

Set `OPENAI_API_KEY` only in the server's secret/environment configuration; do
not put it in `web/`, client-side build variables, source code, or commits. The
provider makes bounded, text-only calls to the OpenAI Responses API with the
explicit default model `gpt-5-mini` and `store: false`. Both developer and user
messages are bounded text inputs, and output is capped before it reaches the
client.

Without a deployment key, local coaching uses deterministic **Demo coaching**.
This is deliberate: a missing key, provider error, timeout, or malformed
provider output returns labelled demo content rather than pretending a live
request succeeded. A failed keyed attempt rolls its reservation back before
that response; the normal no-key demo path remains subject to the same caps.
Do not claim that live OpenAI calls were tested locally unless a configured
deployment key was actually used.

Configure provider-side spend alerts and budgets in the OpenAI account as an
independent operational safeguard. Application limits complement those alerts;
they do not guarantee a particular provider price or a final invoice amount.

### Server configuration

All controls below are server-side environment variables. The runtime rejects a
missing, malformed, non-positive, or unsafe value and keeps the conservative
default instead. Changes take effect in a newly configured server process; do
not expose these variables to the browser.

| Variable | Default | Guardrail |
|---|---:|---|
| `OPENAI_MODEL` | `gpt-5-mini` | Responses model name |
| `AI_USER_DAILY_BUDGET_CENTS` | `3` | Reserved coaching cost per user per server day |
| `AI_PROJECT_MONTHLY_BUDGET_CENTS` | `2500` | Reserved coaching cost across the project per month |
| `AI_DAILY_CALLS_PER_USER` | `3` | Daily-plan requests per user per server day |
| `AI_TUTOR_CALLS_PER_USER` | `5` | POTD-tutor requests per user per server day |
| `AI_CHAT_CALLS_PER_USER` | `10` | Chat requests per user per server day |
| `AI_REFLECTIONS_PER_DUO_PER_WEEK` | `1` | Duo Reflection requests per duo per server week |

The cent values are application reservation caps, not a pricing promise. Keep
provider spend alerts enabled outside DuoGrow and review the provider's current
pricing before changing a model or budget.

## Consent and user controls

Personal AI coaching starts **off**. A person must opt in before their account
can request a coaching response. Each preference save atomically updates that
member's effective Duo Reflection consent; the returned settings state includes
whether consent is mutual. Duo Reflection runs only after both current members
enable it. Either partner can revoke it in that same save, which immediately
prevents new requests even if context construction for an already-started
request is interrupted. The displayed coaching mode is derived from the current
server provider availability on every settings response, rather than from a
previously saved mode.

**Delete AI data** deletes the AI subsystem's preferences, duo-consent records,
and audit metadata. It does not delete the user's DuoGrow account, duo, goals,
daily entries, proofs, or uploaded proof files. To keep a delete/re-consent
cycle from bypassing caps, the app retains only a pseudonymous per-feature daily
quota debit (or the current week for Duo Reflection) and a non-user
project-month aggregate until their enforcement windows expire; neither record
contains prompts, replies, proof data, or a raw user/duo ID.

Chat prompts and replies are ephemeral in DuoGrow: the application does not
persist chat transcripts or prompts. It keeps only the AI settings, usage
counters, and audit metadata needed for consent and limits. A chat request
sends the message the person enters to the coaching provider, so the UI tells
people not to include sensitive personal information.

## Coaching data boundary and retention

General coaching receives only the server-defined aggregate goals and progress
context: selected numeric goal targets, allow-listed daily module status/value
fields, and aggregate weekly progress. Duo Reflection uses the same minimized
view for each partner without names. Insight Explain receives only numeric
growth-score, subscore, and risk-percentage signals; verifier narratives are
never sent to the coaching provider. POTD Tutor receives only the current
assignment's bounded title, body, topic, and difficulty. The browser cannot
supply any contextual payload. Coaching does **not** send proof media, uploaded
files, raw proof detail, proof IDs, user IDs, duo IDs, session tokens, or other
session bearers to OpenAI.

## Account credentials

Registration and login require a user-chosen secret of at least eight
characters and no more than 256 UTF-8 bytes. Both endpoints use the same
bounded raw body reader: `Content-Length` is an early rejection when available,
and chunked or absent-header bodies are counted and cancelled before JSON
parsing at the same 1,024-byte ceiling. They then enforce the secret bound
before a database lookup or hash. A small, bounded in-memory limiter caps
repeated eligible attempts per normalized name; it stores neither secrets nor
credential values, prunes only expired windows, and denies new names while its
active capacity is full. DuoGrow salts and hashes the secret with Node's
asynchronous `scrypt` before storage and uses constant-time comparison for
login; plaintext secrets are neither stored nor returned. A duplicate display
name cannot mint a session, and legacy rows without a credential cannot be
logged into by name alone. Existing sessions remain valid. The deterministic
seed's public sign-ins (`Sreya` / `demo-sreya` and `Sai` / `demo-sai`) are
demo-only credentials, not production accounts.

`store: false` asks the Responses API not to store the response through that
parameter. It is not a claim of Zero Data Retention. Provider retention,
abuse-monitoring, and the availability or eligibility of optional Zero Data
Retention (ZDR) or Modified Abuse Monitoring (MAM) controls must be confirmed
in the customer's OpenAI account and agreement.

## Security boundary for proof files

Session bearer tokens are stored as hashes, not as usable raw tokens. The former
public `/uploads` path is removed. Proof bytes are available only through the
authenticated, duo-authorized `GET /api/proofs/:id/file` endpoint; a requester
outside the proof's duo receives a not-found response.
Successful proof-byte responses include `Cache-Control: private, no-store` and
`Vary: x-session` so shared caches cannot reuse one member's private media.

This proof-file protection does not change the verifier contract: the existing
Anthropic verifier remains separately configured by `ANTHROPIC_API_KEY` and is
the only AI component that receives proof bytes for verification.

## Useful checks

- `npm run verify` covers the web-focused test, typecheck, lint, build, and
  whitespace gate.
- `npm --prefix server run test` covers server contracts, including the
  no-key coaching path and authenticated proof-file access.
- A safe no-key smoke should use `npm run harness:isolated -- <command>` so it
  receives a fresh `DATA_DIR` and deterministic demo AI. It must report
  coaching mode as `demo`; it cannot demonstrate a live call without a key.
