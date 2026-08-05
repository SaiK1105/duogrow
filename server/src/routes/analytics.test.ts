import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { Hono } from "hono";

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "duogrow-analytics-routes-"));

const [{ db }, { analyticsRoutes }, { hashSessionToken }, { today, addDays }, { DEFAULT_USER_CONFIG }] =
  await Promise.all([
    import("../db.js"),
    import("./analytics.js"),
    import("../lib/session.js"),
    import("../lib/dates.js"),
    import("../types.js"),
  ]);

const app = new Hono();
app.route("/api/analytics", analyticsRoutes);

interface SummaryBody {
  range: { from: string; to: string; days: number };
  members: { userId: string; name: string }[];
  series: { date: string; values: number[] }[];
  modules: { module: string; averages: number[]; doneDays: number[] }[];
  current: { completion: number[]; growthScore: number };
  previous: { completion: number[] };
}

interface ProofsBody {
  proofs: { id: string; module: string | null; status: string }[];
  nextCursor: string | null;
}

function makeDuo(suffix: string, memberNames: string[]): string[] {
  const duoId = `duo_${suffix}`;
  db.prepare(`INSERT INTO duos (id, name, invite_code, created_at) VALUES (?, ?, ?, ?)`).run(
    duoId,
    `Duo ${suffix}`,
    `CODE${suffix}`.slice(0, 8),
    new Date().toISOString(),
  );
  return memberNames.map((name, index) => {
    const userId = `usr_${suffix}_${index}`;
    const tokenHash = hashSessionToken(`token-${suffix}-${index}`);
    db.prepare(
      `INSERT INTO users (id, name, name_normalized, duo_id, session_token, session_token_hash, config_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      userId,
      name,
      name.toLowerCase(),
      duoId,
      tokenHash,
      tokenHash,
      JSON.stringify(DEFAULT_USER_CONFIG),
      `2020-01-0${index + 1}T00:00:00.000Z`,
    );
    return userId;
  });
}

function logEntry(duoId: string, userId: string, date: string, module: string, status: "done" | "pending"): void {
  db.prepare(
    `INSERT INTO daily_entries (id, user_id, duo_id, date, module, status, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(`de_${userId}_${date}_${module}`, userId, duoId, date, module, status, new Date().toISOString());
}

async function get(path: string, token: string): Promise<Response> {
  return app.request(`http://localhost/api/analytics${path}`, { headers: { "x-session": token } });
}

const MODULES = ["wake", "study", "workout", "diet", "tasks"];

test("the days parameter is an allow-list, not a clamp", async () => {
  makeDuo("range", ["Ada", "Grace"]);

  assert.equal((await get("/summary?days=31", "token-range-0")).status, 400);
  assert.equal((await get("/summary?days=0", "token-range-0")).status, 400);
  assert.equal((await get("/summary?days=-30", "token-range-0")).status, 400);
  assert.equal((await get("/summary?days=abc", "token-range-0")).status, 400);
  assert.equal((await get("/summary?days=1e2", "token-range-0")).status, 400);

  for (const days of [30, 90, 365]) {
    const response = await get(`/summary?days=${days}`, "token-range-0");
    assert.equal(response.status, 200);
    const body = await response.json() as SummaryBody;
    assert.equal(body.range.days, days);
    assert.equal(body.series.length, days);
  }

  // Omitting the parameter falls back to the smallest supported range.
  const fallback = await (await get("/summary", "token-range-0")).json() as SummaryBody;
  assert.equal(fallback.range.days, 30);
});

test("analytics never reaches beyond the caller's own duo", async () => {
  const [mine] = makeDuo("mine", ["Mine"]);
  const [theirs] = makeDuo("theirs", ["Theirs"]);

  const day = today();
  for (const module of MODULES) {
    logEntry("duo_mine", mine, day, module, "done");
    logEntry("duo_theirs", theirs, day, module, "done");
  }

  const body = await (await get("/summary?days=30", "token-mine-0")).json() as SummaryBody;
  assert.deepEqual(body.members.map((m) => m.userId), [mine]);
  assert.equal(body.members.some((m) => m.userId === theirs), false);

  // The other duo's identical activity must not leak into these totals.
  const todayPoint = body.series[body.series.length - 1];
  assert.equal(todayPoint.values.length, 1);
  assert.equal(todayPoint.values[0], 1);
});

test("completion aggregates match hand-computed values and count unlogged days as zero", async () => {
  const [alpha, beta] = makeDuo("agg", ["Alpha", "Beta"]);
  const day = today();

  // Alpha completes every module today; Beta completes exactly two of five.
  for (const module of MODULES) logEntry("duo_agg", alpha, day, module, "done");
  logEntry("duo_agg", beta, day, "wake", "done");
  logEntry("duo_agg", beta, day, "study", "done");

  const body = await (await get("/summary?days=30", "token-agg-0")).json() as SummaryBody;
  const todayPoint = body.series[body.series.length - 1];
  assert.equal(todayPoint.date, day);
  assert.equal(todayPoint.values[0], 1);
  assert.equal(todayPoint.values[1], 2 / 5);

  // A day with no rows at all scores zero rather than being excluded from the mean.
  const yesterdayPoint = body.series[body.series.length - 2];
  assert.equal(yesterdayPoint.date, addDays(day, -1));
  assert.deepEqual(yesterdayPoint.values, [0, 0]);

  // One perfect day out of thirty, averaged across the range.
  assert.equal(body.current.completion[0], 1 / 30);

  const wake = body.modules.find((m) => m.module === "wake");
  assert.deepEqual(wake?.doneDays, [1, 1]);
  const workout = body.modules.find((m) => m.module === "workout");
  assert.deepEqual(workout?.doneDays, [1, 0]);
});

test("a duo with no history returns an empty-but-valid summary rather than an error", async () => {
  makeDuo("empty", ["Solo"]);

  const response = await get("/summary?days=30", "token-empty-0");
  assert.equal(response.status, 200);

  const body = await response.json() as SummaryBody;
  assert.equal(body.series.length, 30);
  assert.equal(body.series.every((point) => point.values[0] === 0), true);
  assert.equal(body.current.completion[0], 0);
  assert.equal(body.previous.completion[0], 0);
  assert.equal(Number.isFinite(body.current.growthScore), true);
});

test("the previous period covers the range immediately before the current one and never overlaps it", async () => {
  makeDuo("periods", ["Ada"]);

  const body = await (await get("/summary?days=30", "token-periods-0")).json() as SummaryBody;
  const currentFrom = body.range.from;
  const previousTo = (body as unknown as { previous: { to: string; from: string } }).previous.to;

  assert.equal(previousTo, addDays(currentFrom, -1));
});

test("proof history filters, pages, and never repeats or drops a row across page boundaries", async () => {
  const [owner] = makeDuo("proofs", ["Ada"]);

  // Identical timestamps on purpose: created_at alone cannot order these, so a
  // cursor that ignores id would repeat or skip rows at the page boundary.
  const sameInstant = "2026-01-01T00:00:00.000Z";
  for (let index = 0; index < 5; index += 1) {
    db.prepare(
      `INSERT INTO proofs (id, user_id, duo_id, date, file_path, mime_type, target_module, ai_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      `prf_${index}`,
      owner,
      "duo_proofs",
      "2026-01-01",
      `/tmp/secret-${index}.png`,
      "image/png",
      index % 2 === 0 ? "workout" : "study",
      index === 0 ? "rejected" : "verified",
      sameInstant,
    );
  }

  assert.equal((await get("/proofs?module=nope", "token-proofs-0")).status, 400);
  assert.equal((await get("/proofs?status=nope", "token-proofs-0")).status, 400);
  assert.equal((await get("/proofs?limit=0", "token-proofs-0")).status, 400);
  assert.equal((await get("/proofs?limit=101", "token-proofs-0")).status, 400);
  assert.equal((await get("/proofs?cursor=malformed", "token-proofs-0")).status, 400);

  const workout = await (await get("/proofs?module=workout", "token-proofs-0")).json() as ProofsBody;
  assert.equal(workout.proofs.length, 3);
  assert.equal(workout.proofs.every((p) => p.module === "workout"), true);

  const verified = await (await get("/proofs?status=verified", "token-proofs-0")).json() as ProofsBody;
  assert.equal(verified.proofs.length, 4);

  const firstPage = await (await get("/proofs?limit=2", "token-proofs-0")).json() as ProofsBody;
  assert.equal(firstPage.proofs.length, 2);
  assert.ok(firstPage.nextCursor);

  const secondPage = await (await get(`/proofs?limit=2&cursor=${encodeURIComponent(firstPage.nextCursor!)}`, "token-proofs-0")).json() as ProofsBody;
  const lastPage = await (await get(`/proofs?limit=2&cursor=${encodeURIComponent(secondPage.nextCursor!)}`, "token-proofs-0")).json() as ProofsBody;

  const seen = [...firstPage.proofs, ...secondPage.proofs, ...lastPage.proofs].map((p) => p.id);
  assert.equal(seen.length, 5);
  assert.equal(new Set(seen).size, 5, "paging returned a duplicate row");
  assert.equal(lastPage.nextCursor, null);
});

test("proof history never exposes the stored file path", async () => {
  const body = await (await get("/proofs", "token-proofs-0")).json() as ProofsBody;
  assert.doesNotMatch(JSON.stringify(body), /secret-\d\.png/);
  assert.doesNotMatch(JSON.stringify(body), /file_path|filePath/);
});

test("a user without a duo gets a clear conflict rather than an empty dashboard", async () => {
  const tokenHash = hashSessionToken("token-solo");
  db.prepare(
    `INSERT INTO users (id, name, name_normalized, duo_id, session_token, session_token_hash, config_json, created_at)
     VALUES (?, ?, ?, NULL, ?, ?, ?, ?)`,
  ).run("usr_solo", "Solo", "solo", tokenHash, tokenHash, JSON.stringify(DEFAULT_USER_CONFIG), new Date().toISOString());

  assert.equal((await get("/summary", "token-solo")).status, 409);
  assert.equal((await get("/proofs", "token-solo")).status, 409);
});

test("analytics requires a session", async () => {
  const response = await app.request("http://localhost/api/analytics/summary");
  assert.equal(response.status, 401);
});
