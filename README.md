# DuoGrow 🌱

**AI Accountability OS for two.** Pair up with one person, do real things — study, work out,
solve the problem of the day — upload proof, and AI verifies it. Your shared dashboard,
duo streak, and growth score update live for both of you.

*Become better together.*

## Run it

```powershell
npm install            # root (concurrently)
cd server; npm install; cd ..
cd web;    npm install; cd ..

npm run seed           # build demo state (Sreya + Arjun, 7 days of history)
npm run dev            # web on http://localhost:5173, api on :8787
```

Data (SQLite + uploads) lives in `~/.duogrow` — deliberately outside OneDrive.

## AI modes

- **Demo mode (default):** no API key needed. A deterministic verifier produces realistic
  verdicts, so the full flow works offline. `GET /api/health` reports the active mode.
- **Live mode:** copy `.env.example` → `.env` and set `ANTHROPIC_API_KEY`. Proof screenshots
  are verified by Claude vision with structured outputs; insights come from a live model call.
  Set `DEMO_FAKE_AI=1` to force demo mode even with a key (stage insurance).

## 2-minute demo runbook

1. `npm run reset` — restore pristine demo state (safe to re-run between rehearsals).
2. Open **two tabs** of http://localhost:5173 side by side (sessions are per-tab).
3. Tab A: continue as **Sreya** · Tab B: continue as **Arjun** (both seeded + already paired) —
   or register fresh names and pair live with the invite code for the full flow.
4. Tab B (Arjun): Upload Proof → pick any workout screenshot → *Analyzing…* →
   **Verified ✓** with evidence + coach line → dashboard auto-updates, streak 6 → 7.
   Watch Tab A update within 3 seconds.
5. Tab A (Sreya): POTD → today's problem (from the seeded question bank) →
   "I solved it" → upload a screenshot → solved.
6. Tab A: **Cheer Partner** → Tab B pops the cheer toast.
7. Insights tab: growth score ring, risk prediction, weekly report. Land the tagline.

If a live AI call fails mid-demo, the app degrades to a "confirm it yourself" card — the
flow never dies.

## Stack

Vite + React + TS · Hono + better-sqlite3 · Claude API (structured outputs, vision) ·
3s polling for partner sync · sessions per browser tab. See [SPEC.md](SPEC.md) for the
full architecture, schema, and AI contracts.
