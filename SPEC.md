# DuoGrow — Build Spec (MVP, hackathon)

**One-liner:** DuoGrow is an AI Accountability OS for two people. Pair up, do real things
(study, work out, solve a problem-of-the-day), upload proof, and an AI verifies it —
your shared dashboard, streaks, and growth score update live for both partners.

**Tagline:** *Become better together.*

This is the single reconciled spec (stack + scope + AI contracts + design synthesized from
the planning fleet on 2026-07-19). Feed nothing else to build agents.

---

## Stack

- `web/` — Vite + React + TypeScript SPA. React Router. No UI library; hand-rolled components + CSS tokens.
- `server/` — Hono on `@hono/node-server` (port 8787). Raw `better-sqlite3` prepared statements (no ORM).
- Dev: Vite proxies `/api` → `:8787`. Root `npm run dev` runs both via `concurrently`.
- Data: SQLite + uploaded files in `DATA_DIR` (default `~/.duogrow` — **outside OneDrive**; WAL under
  OneDrive sync risks corruption). `npm run seed` builds demo state; `npm run reset` restores it.
- Partner sync: **3s polling** of `GET /api/today` (pause when tab hidden, refetch immediately after mutations).
- Sessions: opaque token in **sessionStorage** (per-tab), sent as `x-session` header.
  Two tabs in one browser = two users. Persisted session bearer values are hashes,
  not usable raw tokens. Registration/login also require a user-chosen secret
  (minimum eight characters and maximum 256 UTF-8 bytes), stored only as
  salted asynchronous `scrypt` output and checked with constant-time
  comparison. Duplicate names cannot mint sessions; legacy users without
  credentials cannot newly log in by name alone. Registration and login reject
  oversized advertised JSON before parsing where possible and apply a bounded
  per-normalized-name attempt limit without retaining secrets.
- AI: `@anthropic-ai/sdk` server-side behind a `Verifier` seam:
  - `AnthropicVerifier` — real calls when `ANTHROPIC_API_KEY` is set. Structured outputs via
    `output_config.format` (json_schema, `additionalProperties:false`, all keys required).
    Models: `PROOF_MODEL` (default `claude-opus-4-8`), `INSIGHTS_MODEL` (default `claude-haiku-4-5`).
    No `temperature`/`top_p`/`top_k` (400 on Opus 4.8). Omit `thinking` (off by default on Opus 4.8).
  - `DemoVerifier` — deterministic, always available. Produces realistic verdicts from the module hint +
    filename keywords + seeded data. Active when no key is set or `DEMO_FAKE_AI=1`. The demo never dies.
- AI coaching is a separate, server-only OpenAI Responses integration for daily
  plans, Insight Explain, Duo Reflection, POTD tutoring, and short chat. It uses bounded,
  text-only `gpt-5-mini` requests with `store: false` and labelled deterministic
  demo fallback when no `OPENAI_API_KEY` is configured or a live request fails;
  a failed keyed attempt rolls its reservation back before the demo response.
  Personal coaching requires opt-in; Duo Reflection additionally requires the
  consent of both current partners. Coaching receives only server-defined
  aggregate goals/progress context—never proof media/files, raw proof detail,
  IDs, or session tokens. Insight Explain receives only numeric growth score,
  subscores, and risk percentage; POTD Tutor receives only bounded current
  title/body/topic/difficulty. See [AI operations](docs/duogrow-ai.md).
  Server-only controls default to `OPENAI_MODEL=gpt-5-mini`, a 3-cent daily
  per-user reservation cap, a 2500-cent monthly project reservation cap, 3
  daily-plan calls/user/day, 5 tutor calls/user/day, 10 chat calls/user/day,
  and 1 reflection/duo/week. Configure provider spend alerts separately; these
  caps are not provider pricing guarantees.

## Data model (15 tables)

users(id, name, duo_id→duos, session_token_hash, credential_salt, credential_hash, config_json, created_at)
duos(id, name, invite_code UNIQUE, potd_mode='same', created_by, created_at)
daily_entries(id, user_id, duo_id, date, module ∈ wake|study|workout|diet|tasks,
  status ∈ pending|done, value REAL, target REAL, detail_json, proof_id, updated_at,
  UNIQUE(user_id,date,module))
proofs(id, user_id, duo_id, date, file_path, mime_type, target_module, target_ref_id,
  ai_status ∈ pending|verified|review|rejected|error, ai_confidence, ai_summary,
  ai_evidence_json, ai_metrics_json, created_at)
potd_questions(id, duo_id, source, topic, difficulty ∈ easy|medium|hard, title, body, answer, created_at)
potd_assignments(id, duo_id, user_id, question_id, date, mode, status ∈ assigned|attempted|solved,
  proof_id, updated_at, UNIQUE(user_id,date))
streaks(id, duo_id, scope, current_streak, longest_streak, last_date, UNIQUE(duo_id,scope))
cheers(id, duo_id, from_user_id, to_user_id, message, emoji, seen, created_at)
ai_preferences(user_id→users, personal_enabled, duo_enabled, policy_version, mode, updated_at)
ai_duo_consents(duo_id→duos, user_id→users, enabled, policy_version, updated_at)
ai_quota_daily(subject_hash, duo_hash, feature, date, request_count, reserved_cost_cents)
ai_project_quota_month(month, reserved_cost_cents)
ai_audit_events(id, event_type, actor_user_id, duo_id, feature, policy_version, created_at)

Streak rule (demo-simple): the **duo streak** is a stored counter, seeded at 6; it increments once
per day on the first HIGH-band verified proof by either partner (`last_date` guards the once-per-day).

## API surface (all `/api`, JSON, `x-session` auth)

- POST /auth/register {name,secret} → user + session token. POST /auth/login {name,secret}. GET /auth/me.
- POST /duo → create (returns invite_code). POST /duo/join {invite_code}. GET /duo.
- GET /today 🔁 → {you, partner, duoProgress, streak, unseenCheers[], growthScore} — the one poll.
- PUT /modules/:module {status,value,detail} → upsert today's entry (wake check-in, study log,
  workout done, diet quick-add, tasks count).
- POST /proofs (multipart: file, module?) → save → verify → band logic:
  HIGH ≥85 auto-apply; MEDIUM 60–84 → status 'review' + suggested update; LOW <60 → 'rejected'.
  POST /proofs/:id/apply (confirm MEDIUM). GET /proofs 🔁, GET /proofs/:id,
  authenticated GET /proofs/:id/file (duo-authorized proof bytes; `private, no-store`, varies by session).
- GET /potd/today 🔁 → today's assignment for both (deterministic seeded pick: fnv1a(duo+date) over
  unsolved questions, same-for-both). POST /potd/upload (PDF/CSV → extract → bank; CSV parsed free,
  PDF via Claude document block when key present). GET /potd/bank.
- POST /cheers {emoji,message} → partner. POST /cheers/:id/seen.
- GET /insights → growth score + subscores + AI narrative (Haiku when key, seeded otherwise).
- GET /ai/settings (includes `mutualDuoConsent`); PUT /ai/settings {personalEnabled,duoEnabled}
  atomically updates the caller's effective duo consent; DELETE /ai/data; POST /ai/daily-plan,
  /ai/insights-explain, /ai/duo-reflection, /ai/potd-tutor, and
  /ai/chat {message}. Coaching endpoints require personal consent; Duo Reflection
  requires mutual current-partner consent and all calls enforce application limits.
- GET /report/weekly → stats card. GET /health.

## Verdict contract (both verifiers return exactly this)

{ task_type: wake|study|workout|diet|task|potd|unknown,
  matched_module: string|null, confidence: 0–100, band: high|medium|low,
  evidence: string[3–6], extracted_metrics: { study_minutes, calories, wake_time,
    workout_name, problem_title, potd_status, detected_text, timestamp_visible — all nullable },
  coach_message: string }

Growth Score (computed in code, deterministic):
Discipline = 40% wake-rate + 40% tasks-rate + 20% min(streak/14,1)
Mind = 60% study-vs-target + 40% potd-solve-rate ・ Health = 60% workout-rate + 40% diet-on-target
Consistency = active-days/7 ・ Score = round(100 · mean of the four)

## Design — "Night Terrarium" (dark, bioluminescent green)

- oklch tokens in `web/src/styles/tokens.css`: near-black green-tinted surfaces, `--accent-500`
  grow-green, amber `--partner-*` hue for the partner, confidence-tier tokens
  (`--confidence-high/medium/low` + `-bg`) — the only hue that changes across the AI flow.
- Fonts: Space Grotesk (display) + Inter (UI), Google Fonts, `font-display: swap`.
- Layout: centered phone column (max 430px) on an ambient-glow backdrop; floating pill tab bar
  Home ・ POTD ・ (+ upload FAB) ・ Insights ・ Profile.
- Screens (all demo-critical): Onboarding/Pairing, Today (You|Partner rows + DuoProgressBar +
  CoachBubble), Upload Proof, **Verification Result** (the money shot: VerifiedStamp overlapping
  card edge, confidence badge, staggered evidence checklist, tier-colored states), POTD, Insights/Weekly.
- Motion budget (only these): stamp pop, ring fill (stroke-dashoffset), number count-up,
  evidence stagger, cheer toast burst. Compositor-friendly properties only.

## Demo seed (Sreya + Sai)

7 days of history satisfying the formulas (growth ≈ 88, streak 6, today partially complete),
~12-question DSA bank tagged (source “Striver SDE Sheet”), today's POTD = “Two Sum (LeetCode #1)”,
a few recent proofs. Reset restores this exactly so rehearsal never poisons the demo.

## Demo script (2 min, two tabs)

1. The seeded demo is already paired. In Tab A, choose **I already have an account** and sign in as **Sreya** / **demo-sreya**. In Tab B, do the same with **Sai** / **demo-sai**; both land on the shared dashboard.
2. Both see the shared Today dashboard (seeded history alive).
3. Sai uploads a workout screenshot → Analyzing… → **Verified ✓ 92%** + evidence + coach line →
   auto-applied; Tab A updates within 3s; duo streak 6→7.
4. Sreya opens POTD (“Two Sum”, from Striver Sheet), uploads a solved screenshot → solved.
5. Sreya hits Cheer → Sai's tab pops a toast burst.
6. Insights: growth score ring, prediction card (72% risk), weekly report. Close on the tagline.
