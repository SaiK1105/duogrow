import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SALT_BYTES = 16;
const KEY_BYTES = 64;

export const MIN_SECRET_LENGTH = 8;

export interface CredentialHash {
  salt: string;
  hash: string;
}

/** Derives a salted, one-way credential record; callers must never retain the supplied secret. */
export function hashCredential(secret: string): CredentialHash {
  const salt = randomBytes(SALT_BYTES);
  const hash = scryptSync(secret, salt, KEY_BYTES);
  return { salt: salt.toString("base64"), hash: hash.toString("base64") };
}

/** Constant-time verification for stored credential records, including malformed legacy values. */
export function verifyCredential(secret: string, salt: string | null, hash: string | null): boolean {
  if (!salt || !hash) return false;
  try {
    const stored = Buffer.from(hash, "base64");
    if (stored.length !== KEY_BYTES) return false;
    const derived = scryptSync(secret, Buffer.from(salt, "base64"), KEY_BYTES);
    return timingSafeEqual(stored, derived);
  } catch {
    return false;
  }
}
