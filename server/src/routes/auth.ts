import { Hono, type Context } from "hono";
import { db } from "../db.js";
import { newId } from "../lib/ids.js";
import { sessionAuth } from "../lib/authMiddleware.js";
import { createSessionToken, hashSessionToken } from "../lib/session.js";
import { hashCredential, MAX_SECRET_BYTES, MIN_SECRET_LENGTH, verifyCredential } from "../lib/credentials.js";
import { credentialAttemptLimiter } from "../lib/authAttemptLimiter.js";
import type { AppEnv } from "../honoEnv.js";
import { DEFAULT_USER_CONFIG, type DuoRow, type UserRow } from "../types.js";

export const authRoutes = new Hono<AppEnv>();
const MAX_AUTH_JSON_BYTES = 1_024;

function publicUser(user: UserRow) {
  return { id: user.id, name: user.name, duoId: user.duo_id };
}

export function findDuoWithMembers(duoId: string): { id: string; name: string; inviteCode: string; members: { id: string; name: string }[] } | null {
  const duo = db.prepare<[string], DuoRow>(`SELECT * FROM duos WHERE id = ?`).get(duoId);
  if (!duo) return null;
  const members = db
    .prepare<[string], { id: string; name: string }>(`SELECT id, name FROM users WHERE duo_id = ?`)
    .all(duoId);
  return { id: duo.id, name: duo.name, inviteCode: duo.invite_code, members };
}

async function readCredentials(c: Context<AppEnv>): Promise<{ name: string; secret: string } | null> {
  const contentLength = c.req.header("content-length");
  if (contentLength !== undefined) {
    const bytes = Number(contentLength);
    if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > MAX_AUTH_JSON_BYTES) return null;
  }
  const body = await c.req.json().catch(() => null);
  const name = body && typeof body === "object" && "name" in body ? (body as { name: unknown }).name : undefined;
  const secret = body && typeof body === "object" && "secret" in body ? (body as { secret: unknown }).secret : undefined;
  return { name: typeof name === "string" ? name.trim() : "", secret: typeof secret === "string" ? secret : "" };
}

function normalizeName(name: string): string {
  return name.normalize("NFKC").toLocaleLowerCase("en-US");
}

function credentialsError(c: Context<AppEnv>, name: string, secret: string): Response | null {
  if (!name) return c.json({ error: "name is required" }, 400);
  if (secret.length < MIN_SECRET_LENGTH) return c.json({ error: `secret must be at least ${MIN_SECRET_LENGTH} characters` }, 400);
  if (Buffer.byteLength(secret, "utf8") > MAX_SECRET_BYTES) return c.json({ error: `secret must be no more than ${MAX_SECRET_BYTES} bytes` }, 400);
  return null;
}

/** Register a new identity. Existing names must use credential-verified login. */
authRoutes.post("/register", async (c) => {
  const credentials = await readCredentials(c);
  if (!credentials) return c.json({ error: "credential request is too large" }, 413);
  const { name, secret } = credentials;
  const invalid = credentialsError(c, name, secret);
  if (invalid) return invalid;
  const normalizedName = normalizeName(name);
  if (!credentialAttemptLimiter.allow(normalizedName)) return c.json({ error: "too many credential attempts; try again shortly" }, 429);

  const existing = db.prepare<[string, string], UserRow>(`SELECT * FROM users WHERE name_normalized = ? OR (name_normalized IS NULL AND name = ? COLLATE NOCASE)`).get(normalizedName, name);
  if (existing) return c.json({ error: "an account with that name already exists — sign in instead" }, 409);
  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);
  const credential = await hashCredential(secret);

  const id = newId("usr");
  try {
    db.prepare(
      `INSERT INTO users (id, name, name_normalized, duo_id, session_token, session_token_hash, credential_salt, credential_hash, config_json, created_at) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)`,
    ).run(id, name, normalizedName, tokenHash, tokenHash, credential.salt, credential.hash, JSON.stringify(DEFAULT_USER_CONFIG), new Date().toISOString());
  } catch (error) {
    if (error instanceof Error && (error.message.includes("idx_users_name_normalized_credential") || error.message.includes("users.name_normalized"))) {
      return c.json({ error: "an account with that name already exists — sign in instead" }, 409);
    }
    return c.json({ error: "account registration is unavailable" }, 503);
  }

  credentialAttemptLimiter.clear(normalizedName);
  return c.json({ token, user: { id, name, duoId: null } });
});

authRoutes.post("/login", async (c) => {
  const credentials = await readCredentials(c);
  if (!credentials) return c.json({ error: "credential request is too large" }, 413);
  const { name, secret } = credentials;
  const invalid = credentialsError(c, name, secret);
  if (invalid) return invalid;
  const normalizedName = normalizeName(name);
  if (!credentialAttemptLimiter.allow(normalizedName)) return c.json({ error: "too many credential attempts; try again shortly" }, 429);

  const existing = db.prepare<[string], UserRow>(`SELECT * FROM users WHERE name_normalized = ? AND credential_hash IS NOT NULL`).get(normalizedName);
  if (!existing || !await verifyCredential(secret, existing.credential_salt, existing.credential_hash)) {
    return c.json({ error: "invalid name or secret" }, 401);
  }

  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);
  db.prepare(`UPDATE users SET session_token = ?, session_token_hash = ? WHERE id = ?`).run(tokenHash, tokenHash, existing.id);
  credentialAttemptLimiter.clear(normalizedName);
  return c.json({ token, user: publicUser({ ...existing, session_token: tokenHash, session_token_hash: tokenHash }) });
});

authRoutes.get("/me", sessionAuth, (c) => {
  const user = c.get("user");
  const duo = user.duo_id ? findDuoWithMembers(user.duo_id) : null;
  return c.json({ user: publicUser(user), duo });
});
