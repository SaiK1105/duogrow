import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { Hono } from "hono";

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "duogrow-auth-routes-"));

const [{ db }, { authRoutes }] = await Promise.all([
  import("../db.js"),
  import("./auth.js"),
]);

const app = new Hono();
app.route("/api/auth", authRoutes);

async function auth(path: "/register" | "/login", payload: Record<string, unknown>, extraHeaders: Record<string, string> = {}): Promise<Response> {
  return app.request(`http://localhost/api/auth${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...extraHeaders },
    body: JSON.stringify(payload),
  });
}

async function streamedAuthWithoutContentLength(path: "/register" | "/login", chunks: Uint8Array[]): Promise<{ response: Response; cancelled: boolean }> {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
    },
    cancel() {
      cancelled = true;
    },
  });
  const request = new Request(`http://localhost/api/auth${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    duplex: "half",
  } as RequestInit);
  assert.equal(request.headers.has("content-length"), false);
  return { response: await app.request(request), cancelled };
}

test("registration and login require a secret and never return or persist it as plaintext", async () => {
  assert.equal((await auth("/register", { name: "Ada", secret: "short" })).status, 400);

  const created = await auth("/register", { name: "Ada", secret: "correct horse battery staple" });
  assert.equal(created.status, 200);
  const body = await created.json() as { token: string; user: { name: string } };
  assert.equal(body.user.name, "Ada");
  assert.ok(body.token.length > 20);
  assert.doesNotMatch(JSON.stringify(body), /correct horse battery staple/);

  const user = db.prepare("SELECT credential_salt, credential_hash FROM users WHERE name = ?").get("Ada") as { credential_salt: string; credential_hash: string };
  assert.ok(user.credential_salt.length > 10);
  assert.ok(user.credential_hash.length > 20);
  assert.doesNotMatch(JSON.stringify(user), /correct horse battery staple/);
});

test("a duplicate name never mints a session and login verifies the identity-bound secret", async () => {
  const first = await auth("/register", { name: "Grace", secret: "grace-secret-123" });
  assert.equal(first.status, 200);
  const before = db.prepare("SELECT session_token_hash FROM users WHERE name = ?").get("Grace") as { session_token_hash: string };

  const duplicate = await auth("/register", { name: "Grace", secret: "attacker-secret-123" });
  assert.equal(duplicate.status, 409);
  const duplicateBody = await duplicate.json() as Record<string, unknown>;
  assert.equal("token" in duplicateBody, false);
  const afterDuplicate = db.prepare("SELECT session_token_hash FROM users WHERE name = ?").get("Grace") as { session_token_hash: string };
  assert.equal(afterDuplicate.session_token_hash, before.session_token_hash);

  assert.equal((await auth("/login", { name: "Grace", secret: "wrong-secret-123" })).status, 401);
  const loggedIn = await auth("/login", { name: "Grace", secret: "grace-secret-123" });
  assert.equal(loggedIn.status, 200);
  assert.ok((await loggedIn.json() as { token: string }).token.length > 20);
});

test("case-normalized duplicate names are rejected as the same credential identity", async () => {
  assert.equal((await auth("/register", { name: "Case Fold", secret: "case-fold-secret" })).status, 200);
  assert.equal((await auth("/register", { name: "case fold", secret: "different-secret" })).status, 409);
});

test("the database invariant rejects a second normalized credential identity", async () => {
  assert.equal((await auth("/register", { name: "Database Guard", secret: "database-guard-secret" })).status, 200);

  assert.throws(() => {
    db.prepare(`INSERT INTO users (id, name, name_normalized, duo_id, session_token, session_token_hash, credential_salt, credential_hash, config_json, created_at)
      VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)`)
      .run("duplicate-db-user", "database guard", "database guard", "duplicate-token", "duplicate-token-hash", "salt", "credential-hash", "{}", new Date().toISOString());
  }, /UNIQUE/);
});

test("legacy users without a credential cannot log in by name alone", async () => {
  db.prepare("INSERT INTO users (id, name, duo_id, session_token, session_token_hash, config_json, created_at) VALUES (?, ?, NULL, ?, ?, ?, ?)")
    .run("legacy-user", "Legacy", "legacy-token", "legacy-token", "{}", new Date().toISOString());

  assert.equal((await auth("/login", { name: "Legacy", secret: "anything-long-enough" })).status, 401);
});

test("credential endpoints reject oversized secret bytes and advertised JSON before database or scrypt work", async () => {
  const oversizedSecret = "é".repeat(129);
  const registration = await auth("/register", { name: "Too long", secret: oversizedSecret });
  assert.equal(registration.status, 400);
  assert.equal((db.prepare("SELECT count(*) AS count FROM users WHERE name = ?").get("Too long") as { count: number }).count, 0);

  assert.equal((await auth("/register", { name: "Valid size", secret: "valid-size-secret" })).status, 200);
  assert.equal((await auth("/login", { name: "Valid size", secret: oversizedSecret })).status, 400);
  const oversizedPayload = await auth("/register", { name: "Advertised body", secret: "valid-size-secret" }, { "content-length": "1025" });
  assert.equal(oversizedPayload.status, 413);
  assert.equal((db.prepare("SELECT count(*) AS count FROM users WHERE name = ?").get("Advertised body") as { count: number }).count, 0);
});

test("credential endpoints cancel oversized streamed bodies without a Content-Length header", async () => {
  const encoder = new TextEncoder();
  const oversizedJson = JSON.stringify({ name: "Streamed body", secret: "x".repeat(1_100) });
  const chunks = [encoder.encode(oversizedJson.slice(0, 512)), encoder.encode(oversizedJson.slice(512))];

  const registration = await streamedAuthWithoutContentLength("/register", chunks);
  assert.equal(registration.response.status, 413);
  assert.equal(registration.cancelled, true);
  assert.equal((db.prepare("SELECT count(*) AS count FROM users WHERE name = ?").get("Streamed body") as { count: number }).count, 0);

  const login = await streamedAuthWithoutContentLength("/login", chunks);
  assert.equal(login.response.status, 413);
  assert.equal(login.cancelled, true);
});

test("repeated failed credential attempts are bounded per normalized name", async () => {
  assert.equal((await auth("/register", { name: "Rate limited", secret: "correct-secret" })).status, 200);
  for (let attempt = 0; attempt < 10; attempt += 1) {
    assert.equal((await auth("/login", { name: "RATE LIMITED", secret: `wrong-secret-${attempt}` })).status, 401);
  }
  assert.equal((await auth("/login", { name: "rate limited", secret: "wrong-secret-final" })).status, 429);
});

test("credential capacity churn does not block a new correct registration or login while an exhausted name remains blocked", async () => {
  const protectedName = "Capacity protected";
  const protectedSecret = "capacity-protected-secret";
  const loginName = "Capacity login";
  const loginSecret = "capacity-login-secret";
  assert.equal((await auth("/register", { name: protectedName, secret: protectedSecret })).status, 200);
  assert.equal((await auth("/register", { name: loginName, secret: loginSecret })).status, 200);

  for (let attempt = 0; attempt < 2_005; attempt += 1) {
    assert.equal((await auth("/login", { name: `Unknown capacity ${attempt}`, secret: "unknown-capacity-secret" })).status, 401);
  }

  for (let attempt = 0; attempt < 10; attempt += 1) {
    assert.equal((await auth("/login", { name: protectedName, secret: `wrong-capacity-secret-${attempt}` })).status, 401);
  }
  assert.equal((await auth("/login", { name: protectedName, secret: "wrong-capacity-secret-final" })).status, 429);
  assert.equal((await auth("/register", { name: "Capacity admitted", secret: "capacity-admitted-secret" })).status, 200);
  assert.equal((await auth("/login", { name: loginName, secret: loginSecret })).status, 200);
  assert.equal((await auth("/login", { name: protectedName, secret: protectedSecret })).status, 429);
});
