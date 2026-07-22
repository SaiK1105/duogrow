import { createHash } from "node:crypto";

/** Stable opaque key for short-lived quota records; it contains no user-supplied content. */
export function quotaSubject(identifier: string): string {
  return createHash("sha256").update("duogrow-ai-quota-v1\0").update(identifier).digest("base64url");
}
