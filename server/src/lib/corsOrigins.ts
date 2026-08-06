/**
 * Origins a native shell is allowed to call the API from.
 *
 * Production on the web is single-origin, so browsers never send an Origin the
 * API has to approve. A Capacitor shell is different: its webview serves the SPA
 * from `capacitor://localhost` (iOS) or `https://localhost` (Android), making
 * every request cross-origin.
 *
 * The list is explicit rather than a wildcard because the session token travels
 * in the `x-session` header. `Access-Control-Allow-Origin: *` would let any site
 * a signed-in person visits read authenticated responses.
 */
const NATIVE_ORIGINS: readonly string[] = [
  "capacitor://localhost",
  "https://localhost",
];

/** Vite's dev server, so a browser pointed at :5173 can reach an API on :8787. */
const DEV_ORIGINS: readonly string[] = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

export interface CorsOriginOptions {
  /** Comma-separated extra origins, e.g. a staging build's host. */
  readonly extra?: string;
  readonly includeDev?: boolean;
}

/**
 * An origin is scheme + host + optional port and nothing else. Rejecting values
 * with a path or trailing slash matters: a mis-specified entry that never
 * matches would fail open into "no origin allowed", which looks like a broken
 * app rather than a broken config.
 */
export function isValidOrigin(value: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  // Compared against protocol+host rather than URL.origin: `capacitor:` is not a
  // "special" scheme, so the spec defines its origin as opaque and serialises it
  // as the string "null" — using .origin would reject the one scheme this list
  // exists to support.
  const rebuilt = `${parsed.protocol}//${parsed.host}`;
  if (rebuilt !== value || parsed.host === "") return false;
  return (parsed.pathname === "" || parsed.pathname === "/") && !parsed.search && !parsed.hash;
}

export function buildAllowedOrigins(options: CorsOriginOptions = {}): string[] {
  const extra = (options.extra ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0 && isValidOrigin(entry));

  const all = [...NATIVE_ORIGINS, ...(options.includeDev ? DEV_ORIGINS : []), ...extra];
  return [...new Set(all)];
}

/**
 * Returns the origin to echo back, or null to deny. Requests with no Origin
 * header never reach here — same-origin production traffic must keep working
 * exactly as before.
 */
export function resolveAllowedOrigin(origin: string, allowed: readonly string[]): string | null {
  return allowed.includes(origin) ? origin : null;
}
