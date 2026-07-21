# DuoGrow — Handover

Everything you need to **present DuoGrow at the hackathon** and **keep building
it**. Written for Sreya. No prior context assumed.

- **Live app:** **https://duogrow.onrender.com** (deployed on Render, demo mode)
- **Repo:** `https://github.com/SaiK1105/duogrow` (private — you're invited)
- **One-liner:** *An AI Accountability OS for two. You and your partner do real
  things, upload proof, AI verifies it, and your shared streak and growth score
  update live for both of you.*

---

## 1. Pitch script + demo runbook

### The 90-second story (what to say)

1. **The problem.** Solo habit apps fail because no one's watching. Accountability
   works when it's *shared* — but group apps are noisy. DuoGrow is built for
   exactly **two** people who commit to growing together.
2. **The twist.** You don't just tick a box — you upload **proof**, and **AI
   verifies** it. A workout screenshot, a solved LeetCode problem, a study
   timer. No lying to your streak.
3. **The magic moment (do it live).** Upload a proof → watch it get **Verified**
   with a confidence score and evidence → the dashboard updates → **your
   partner's screen updates within 3 seconds**, no refresh.
4. **Close on the tagline:** *Become better together.*

### The click-by-click demo (2 minutes, two browser tabs)

The two tabs act as the two partners. Open the live URL in **two tabs** side by side.

1. **Tab A** — enter the name **Sreya** → Continue. **Tab B** — enter **Sai**.
   Both land on the shared dashboard (already paired, 6-day streak, growth 86).
2. **Point out the shared dashboard** — both partners, today's progress rings,
   the duo streak, the coach message.
3. **The money shot (Tab A, as Sreya):** open the **Workout** module → **Upload
   Proof** → pick any image (a screenshot works) → *Analyzing…* → **Verified ✓
   ~92%** with an evidence checklist and a coach line. The workout flips to Done,
   Sreya's ring jumps, and the **duo streak goes 6 → 7**.
4. **Cross-tab sync:** glance at **Tab B (Sai)** — it reflects the streak bump
   and Sreya's progress within ~3 seconds, untouched.
5. **Problem of the Day:** open **POTD** → today's problem is **"Two Sum"** →
   "I solved it" → upload a screenshot → solved.
6. **Cheer:** hit **Cheer Partner** in one tab → the other tab pops a toast.
7. **Insights:** open **Insights** — the growth-score ring, sub-scores
   (discipline / mind / health / consistency), and the weekly view. Land the tagline.

### Pre-pitch checklist (do this 5–10 min before you present)

- [ ] **Wake the server.** The free tier sleeps after ~15 min idle and takes
      ~50 seconds to wake. Open the live URL a few minutes early so the first
      click on stage is instant.
- [ ] **Confirm it's healthy:** visit `<live-url>/api/health` — you should see
      `{"ok":true,"mode":"demo"}`.
- [ ] **Fresh demo data:** in the Render dashboard, **Manual Deploy → Restart
      service** (or just let it be — it reseeds pristine on every boot). Wait for
      it to come back, then reload the app.
- [ ] Open **two tabs**, log in as **Sreya** and **Sai**, and do one dry run.
- [ ] Have a backup image ready to upload (any screenshot on your machine).

> **If the app ever looks like it reset mid-demo,** that's just the free tier
> restarting — the data reseeds to the pristine state automatically. Log in
> again as Sreya/Sai and keep going. It never breaks the flow.

---

## 2. What's done vs. what's left (the honest backlog)

**Done and working:** the full duo flow (pair, per-module tracking, proof upload
→ AI verify → auto-apply, duo streak, growth score, Problem of the Day with a
question bank, cheers, insights), live 3-second partner sync, a deterministic
demo AI that never fails on stage, and a one-command production deploy.

**Deliberately simple for the hackathon (good answers to judge questions):**

| Area | Current state | To productionize |
|---|---|---|
| Auth | Name-only, session-token per tab (demo-grade) | Real accounts (email/OAuth), proper session security |
| Partner sync | 3-second polling | WebSockets / SSE for instant push |
| AI verification | Demo verifier (deterministic) | Set `ANTHROPIC_API_KEY` → live Claude vision (already wired) |
| Data durability | SQLite on ephemeral disk (reseeds on restart) | Managed Postgres, or Render paid disk for persistence |
| Proof images | Stored full-size on disk | Thumbnails + compression + object storage (S3/R2) |
| Scale | Single instance, single duo demo | Multi-duo is supported by the schema; needs load testing |
| Mobile | Responsive web (phone-framed) | PWA install / React Native wrapper |
| Tests | Typecheck + manual smoke test | Unit (Vitest) + E2E (Playwright) |

The AI seam is the strongest "next step" to show ambition: flipping to live
Claude vision is a single env var — the `AnthropicVerifier` is already written.

---

## 3. Architecture (so you can change things)

```
DUOGROW/
├── web/            React SPA (Vite). Screens in web/src/screens/, API client in web/src/api/
├── server/         Hono API. Routes in server/src/routes/, logic in server/src/lib/
│   └── src/
│       ├── index.ts        server entry — mounts /api routes, serves /uploads, (prod) serves web/dist
│       ├── db.ts           opens SQLite at ~/.duogrow, creates the 8-table schema
│       ├── seed.ts         wipes + seeds the pristine demo (run by npm run seed/reset)
│       ├── routes/         auth, duo, today, modules, proofs, potd, cheers, insights, report, health
│       └── lib/            verifier seam, applyProof, streaks, weeklyStats (growth score), potd, ...
├── scripts/        wait-for-api.mjs — dev helper (starts Vite only after the API is up)
├── render.yaml     Render blueprint (one-click deploy config)
├── SPEC.md         the single source-of-truth spec
├── AGENTS.md       context file AI coding agents read automatically
└── HANDOVER.md     this file
```

**Request flow:** the SPA calls relative `/api/...` (`web/src/api/client.ts`) →
in production the same Hono server serves both the SPA and the API (one origin,
no CORS); in dev, Vite serves the SPA on :5173 and proxies `/api` to :8787.

**The AI verifier seam** (`server/src/lib/verifier.ts`) is the heart of the app:
- `getVerifier()` returns `AnthropicVerifier` when `ANTHROPIC_API_KEY` is set
  (and `DEMO_FAKE_AI` isn't `1`), otherwise the `DemoVerifier`.
- A proof gets a **confidence** and a **band**: **high** auto-applies to the
  dashboard, **medium** shows a "confirm it yourself" card, **low** is rejected.
  (Design cutoffs: ≥85 high, 60–84 medium, <60 low.)
- Only the **first high-band verified proof of the day** advances the duo streak
  (`server/src/lib/streaks.ts`).

**The demo seed is deterministic** — today's POTD ("Two Sum") is *derived* by the
same `fnv1a(duoId:date)` hash the API uses, not hardcoded, so `npm run reset`
always reproduces the exact demo state.

---

## 4. Ops guide (Render)

The app is a single Render **web service** defined by [render.yaml](render.yaml).

- **Redeploy:** every `git push` to the default branch auto-deploys (and reseeds).
- **Manual redeploy / reset demo:** Render dashboard → the `duogrow` service →
  **Manual Deploy** → *Deploy latest commit* (or *Restart service* to just
  reseed without a code change).
- **Logs:** the service's **Logs** tab (live). Look for
  `DuoGrow listening on http://localhost:<port> (AI mode: demo)`.
- **Env vars:** the service's **Environment** tab. To go **live AI**, add
  `ANTHROPIC_API_KEY = sk-ant-...` and redeploy — the health endpoint will then
  report `"mode":"live"`. To force demo again without removing the key, add
  `DEMO_FAKE_AI = 1`.
- **Cold start:** free tier sleeps after ~15 min idle (~50s to wake). See the
  pre-pitch checklist.
- **Data:** free tier disk is ephemeral — every restart reseeds the pristine
  demo. That's intentional for the demo. For real users you'd add a persistent
  database (see the backlog).

---

## 5. Continuing the work with Codex CLI

Codex CLI is OpenAI's terminal coding agent (the counterpart to Claude Code). It
reads `AGENTS.md` automatically and can implement backlog items for you.

### One-time setup

1. **Install prerequisites:** Node.js ≥ 22 and git. Check with `node --version`.
2. **Install Codex:**
   ```bash
   npm install -g @openai/codex
   ```
3. **Sign in:** run `codex` once and choose **Sign in with ChatGPT** (a Plus/Pro
   plan includes Codex usage), or paste an OpenAI API key. Follow the browser prompt.
4. **Get the code:**
   ```bash
   git clone https://github.com/SaiK1105/duogrow.git
   cd duogrow
   npm install && npm --prefix server install && npm --prefix web install
   npm run seed
   npm run dev      # http://localhost:5173
   ```

### Running Codex

From the `duogrow` folder, run:
```bash
codex
```
It picks up `AGENTS.md` automatically (stack, commands, gotchas). Then describe
what you want in plain English.

### Harness workflow for nontrivial changes

For a multi-file feature, bug fix, or change that can affect routes, data, or
the demo flow, create a tracked harness run first:

```bash
npm run harness:doctor
npm run harness:run -- --id <lowercase-id>
```

The second command creates an ignored ledger at `.agent-state/<id>/status.md`;
choose a new lowercase ID because an existing ledger is never overwritten. The
standard agent sequence is `duogrow-scout` (read-only evidence),
`duogrow-implementer` (one owned file set), `duogrow-reviewer` (read-only
findings), then `duogrow-verifier` (commands, exit codes, coverage, data path,
and remaining risks). Reviewers and verifiers do not edit.

Example assignment: ask `duogrow-scout` to trace the proof-upload flow, give
`duogrow-implementer` ownership of the named route and its focused tests, ask
`duogrow-reviewer` to assess the diff, then ask `duogrow-verifier` to run the
approved checks and record the outcome in the ledger.

For smoke checks that may initialize or write application data, use temporary
demo-only data:

```bash
npm run harness:isolated -- npm run seed
npm run harness:isolated -- npm run verify
npm run verify
```

`harness:isolated` creates and retains an OS-temp `DATA_DIR`, forces
`DEMO_FAKE_AI=1`, and removes every casing of `ANTHROPIC_API_KEY` from the child
environment. On Windows, `.cmd` and `.bat` inputs containing whitespace,
quotes, or command-shell metacharacters are rejected. Never treat it as
permission to reset normal user data. `npm run verify` / `npm run verify:ci`
runs web tests, typecheck, web lint, a production build, and whitespace-diff
checks only; server integration and a tracked two-browser E2E suite are planned
coverage, not passing tests.

- **Approval mode:** start in the default **Suggest / read-only** mode so Codex
  proposes changes and you approve each one. Only switch to auto-apply once you
  trust a task. **Review every diff before accepting.**
- **After any change Codex makes**, before committing: run `npm run typecheck`
  and do the two-tab smoke test (or `npm run build && npm start` → open
  http://localhost:8787). Never commit `.env`.

### Good starter prompts (wired to the backlog)

- *"Replace the 3-second polling in the web app with a WebSocket connection so
  partner updates are instant. Keep the polling as a fallback."*
- *"Add Vitest and write unit tests for the growth-score calculation in
  server/src/lib/weeklyStats.ts, then for the streak rule in streaks.ts."*
- *"Add image compression and thumbnail generation for uploaded proofs so we
  don't store full-size images."*
- *"Add a real email + password auth flow to replace the name-only login, using
  the existing session-token mechanism as the session layer."*

### Guardrails for Codex (and any AI agent)

- One focused change at a time; review the diff.
- Keep the demo intact — after changes, `npm run reset` must still produce the
  pristine Sreya & Sai state and the two-tab demo must still work.
- Don't weaken the gotchas in `AGENTS.md` (the `API_PORT`/`PORT` split, the
  production-only dynamic static-serving import).
- Never commit secrets. `.env` stays local; Render's dashboard holds real keys.
