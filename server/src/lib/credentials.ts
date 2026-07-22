import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const SALT_BYTES = 16;
const KEY_BYTES = 64;
const scryptAsync = promisify(scrypt);

export const MIN_SECRET_LENGTH = 8;
export const MAX_SECRET_BYTES = 256;

export interface CredentialHash {
  salt: string;
  hash: string;
}

/** Derives a salted, one-way credential record without blocking the request loop. */
export async function hashCredential(secret: string): Promise<CredentialHash> {
  if (Buffer.byteLength(secret, "utf8") > MAX_SECRET_BYTES) throw new RangeError("secret exceeds the maximum byte length");
  const salt = randomBytes(SALT_BYTES);
  const hash = await scryptAsync(secret, salt, KEY_BYTES) as Buffer;
  return { salt: salt.toString("base64"), hash: hash.toString("base64") };
}

/** Constant-time verification for stored credential records, including malformed legacy values. */
export async function verifyCredential(secret: string, salt: string | null, hash: string | null): Promise<boolean> {
  if (!salt || !hash) return false;
  if (Buffer.byteLength(secret, "utf8") > MAX_SECRET_BYTES) return false;
  try {
    const stored = Buffer.from(hash, "base64");
    if (stored.length !== KEY_BYTES) return false;
    const rawSalt = Buffer.from(salt, "base64");
    if (rawSalt.length !== SALT_BYTES) return false;
    const derived = await scryptAsync(secret, rawSalt, KEY_BYTES) as Buffer;
    return timingSafeEqual(stored, derived);
  } catch {
    return false;
  }
}
