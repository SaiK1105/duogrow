# AGENTS.md — DuoGrow

Project context for AI coding agents (Codex CLI, Claude Code, etc.). Read this
before making changes. Human-facing handover lives in [HANDOVER.md](HANDOVER.md).

## What this is

DuoGrow is an "AI Accountability OS **for two**." Two paired people do real
things (study, workout, diet, wake time, tasks, a daily coding problem), upload
photo proof, and an AI verifier confirms it. A shared dashboard, duo streak, and
growth score update live for both partners. Tagline: *Become better together.*

## Stack

- **web/** — Vite + React 19 + TypeScript SPA. Routing is **HashRouter** (URLs
  look like `/#/today`). API access is a hardcoded **relative** `BASE = "/api"`
  (see `web/src/api/client.ts`) — the frontend must be same-origin with the API
  or behind a proxy. Screens in `web/src/screens/`.
- **server/** — Hono + `@hono/node-server`, raw `better-sqlite3` (hand-written
  SQL, no ORM). ESM, run with `tsx` (no compile step). Entry: `server/src/index.ts`.
  Routes in `server/src/routes/`, logic in `server/src/lib/`.
- **Sync** — no websockets; the client polls every 3s for partner updates.
- **Sessions** — per browser tab via `sessionStorage` (`duogrow.session`), sent
  as the `x-session` header. Two tabs of the same browser = the two partners.
- **Data** — SQLite + uploads under `~/.duogrow` (override with `DATA_DIR`).
  Kept **outside OneDrive** on the dev machine to avoid WAL corruption under sync.

## Commands (run from repo root)

| Command | What it does |
|---|---|
| `npm install` + `npm --prefix server install` + `npm --prefix web install` | Install all deps |
| `npm run dev` | Dev: API on :8787, web on :5173 (API starts first, then Vite) |
| `npm run seed` / `npm run reset` | Wipe + reseed the pristine demo (Sreya & Sai) |
| `npm run build` | Build the web SPA to `web/dist` |
| `npm start` | **Production**: one process serves API + built SPA on :8787 |
| `npm run typecheck` | `tsc --noEmit` for server + `tsc -b` for web |

**Verify before every commit:** `npm run typecheck`, then either the `npm run dev`
two-tab smoke test or `npm run build && npm start` and open http://localhost:8787.

## Conventions

- TypeScript throughout; explicit types on exported functions. No `any` in app code.
- Small, focused files. Errors handled explicitly — never swallowed.
- Immutable updates (spread, not in-place mutation).
- SQL is parameterized (`db.prepare(...).run(...)`), never string-concatenated.
- Conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`).

## Codex agentic harness

For any nontrivial Codex task, use the mandatory harness lifecycle:

```text
Task brief → scout evidence → plan and file ownership → implementation →
read-only review → verification → ignored state ledger → user handoff.
```

Start a new run with `npm run harness:run -- --id <lowercase-id>`. It creates an
ignored ledger at `.agent-state/<id>/status.md` and refuses to overwrite an
existing ID. Record scope, owned files, commands and exit codes, isolated data
path, findings, commits, and residual risks there. Assign exactly one writer to
each file set. `duogrow-scout` and `duogrow-reviewer` are sandbox-enforced
read-only;
`duogrow-verifier` runs commands without editing but inherits the caller's
permissions.

Use `duogrow-scout` to collect read-only code evidence, `duogrow-implementer`
for the owned change, `duogrow-reviewer` for findings, and `duogrow-verifier`
for command results. Run `npm run harness:doctor` before relying on the harness.
Use `npm run harness:isolated -- <command>` for cooperating data-affecting smoke
commands: it supplies a fresh temporary `DATA_DIR`, forces demo AI, removes all
`ANTHROPIC_API_KEY` casing, and retains the directory for inspection. It is not
a sandbox, does not remove other secrets, and a command can ignore `DATA_DIR`.
Get explicit permission before any command that may touch normal or untrusted
data. Command interpreters (cmd, PowerShell, and pwsh) and .cmd/.bat launchers
are rejected outright as a safety boundary: the wrapper never invokes a command
shell. See [`docs/agent-harness/safety.md`](docs/agent-harness/safety.md).

Use `npm run verify` (or `npm run verify:ci`) for the standard web-focused gate.
It does not cover server integration or tracked two-browser E2E flows; plan
those checks explicitly when the change touches routes, SQLite, sessions,
proofs, verifier behavior, or schema.

## Gotchas (these have bitten before — don't rediscover them)

- **Port env var is `API_PORT`, not `PORT`.** The server reads
  `API_PORT || PORT || 8787`. Local dev pins `API_PORT=8787` in `.env` because
  some tooling injects `PORT=5173`, which would otherwise steal the API's port.
  On a host (Render), leave `API_PORT` unset so the injected `PORT` is used.
- **Static serving is production-only**, gated behind the `--serve-web` flag that
  the `start` script passes. In dev, Vite serves the SPA and proxies `/api` — the
  server must not serve `web/dist`. `serve-static` is a **dynamic** import so it
  never enters dev's `tsx watch` file-graph (a static import there wedges the
  watcher under `concurrently`). Don't convert it back to a static import.
- **AI runs in demo mode by default** (deterministic `DemoVerifier`). Set
  `ANTHROPIC_API_KEY` to enable live Claude vision (`AnthropicVerifier`). Set
  `DEMO_FAKE_AI=1` to force demo even with a key. The seam is
  `server/src/lib/verifier.ts` (`getVerifier()` / `isLiveMode()`).
- **`npm start` needs `web/dist`** — run `npm run build` first, or the server
  boots API-only and warns about the missing SPA.
- **Never commit `.env`** (it's gitignored). Secrets go in the host's env-var UI.

## Where things live

- Verifier seam: `server/src/lib/verifier.ts`, `demoVerifier.ts`, `anthropicVerifier.ts`
- Proof upload + apply: `server/src/routes/proofs.ts`, `server/src/lib/applyProof.ts`
- Streak rule (first HIGH-band proof/day advances it): `server/src/lib/streaks.ts`
- Growth score: `server/src/lib/weeklyStats.ts`
- Deterministic demo seed: `server/src/seed.ts`
- Single spec: [SPEC.md](SPEC.md). Deploy blueprint: [render.yaml](render.yaml).
