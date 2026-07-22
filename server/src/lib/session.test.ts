import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { hashSessionToken } from "./session.js";

test("hashSessionToken is deterministic and never returns the bearer token", () => {
  const token = "a-bearer-token-that-must-not-be-persisted";

  assert.equal(hashSessionToken(token), hashSessionToken(token));
  assert.notEqual(hashSessionToken(token), token);
});

test("a seeded-style hashed session authenticates but cannot fetch another duo's proof file", async () => {
  process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "duogrow-session-test-"));
  const [{ db, UPLOADS_DIR }, { proofRoutes }] = await Promise.all([
    import("../db.js"),
    import("../routes/proofs.js"),
  ]);
  const { writeFile } = await import("node:fs/promises");
  const { Hono } = await import("hono");

  db.prepare(
    "INSERT INTO duos (id, name, invite_code, created_at) VALUES (?, ?, ?, ?)",
  ).run("duo-owner", "Owner duo", "owner-code", "2026-01-01T00:00:00.000Z");
  db.prepare(
    "INSERT INTO duos (id, name, invite_code, created_at) VALUES (?, ?, ?, ?)",
  ).run("duo-outsider", "Outsider duo", "outsider-code", "2026-01-01T00:00:00.000Z");
  const outsiderToken = "demo-sreya";
  const outsiderTokenHash = hashSessionToken(outsiderToken);
  db.prepare(
    "INSERT INTO users (id, name, duo_id, session_token, session_token_hash, config_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run("usr_demo_sreya", "Sreya", "duo-outsider", outsiderTokenHash, outsiderTokenHash, "{}", "2026-01-01T00:00:00.000Z");
  const filePath = join(UPLOADS_DIR, "foreign-proof.jpg");
  await writeFile(filePath, "not an image");
  db.prepare(
    `INSERT INTO proofs (id, user_id, duo_id, date, file_path, mime_type, ai_status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run("proof-owner", "usr_demo_sreya", "duo-owner", "2026-01-01", filePath, "image/jpeg", "verified", "2026-01-01T00:00:00.000Z");

  const app = new Hono();
  app.route("/api/proofs", proofRoutes);
  const response = await app.request("http://localhost/api/proofs/proof-owner/file", {
    headers: { "x-session": outsiderToken },
  });

  assert.equal(response.status, 404);
});

test("authenticated proof bytes are explicitly private and vary by session", async () => {
  process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "duogrow-proof-cache-test-"));
  const [{ db, UPLOADS_DIR }, { proofRoutes }, { hashSessionToken: hashToken }, { writeFile }, { Hono }] = await Promise.all([
    import("../db.js"),
    import("../routes/proofs.js"),
    import("./session.js"),
    import("node:fs/promises"),
    import("hono"),
  ]);
  const token = "owner-proof-token";
  db.prepare("INSERT INTO duos (id, name, invite_code, created_at) VALUES (?, ?, ?, ?)").run("duo-cache", "Cache", "cache-code", "2026-01-01");
  db.prepare("INSERT INTO users (id, name, duo_id, session_token, session_token_hash, config_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run("cache-owner", "Owner", "duo-cache", hashToken(token), hashToken(token), "{}", "2026-01-01");
  const filePath = join(UPLOADS_DIR, "private-proof.jpg");
  await writeFile(filePath, "private");
  db.prepare("INSERT INTO proofs (id, user_id, duo_id, date, file_path, mime_type, ai_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run("cache-proof", "cache-owner", "duo-cache", "2026-01-01", filePath, "image/jpeg", "verified", "2026-01-01");
  const app = new Hono();
  app.route("/api/proofs", proofRoutes);
  const response = await app.request("http://localhost/api/proofs/cache-proof/file", { headers: { "x-session": token } });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("vary"), "x-session");
});
