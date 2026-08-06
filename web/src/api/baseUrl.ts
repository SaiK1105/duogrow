const API_PATH = '/api'

/**
 * Where API requests are sent.
 *
 * On the web this stays relative: production serves the SPA and the API from one
 * origin, and a relative path keeps it that way with no configuration.
 *
 * A native shell cannot use a relative path — inside the webview it resolves
 * against the app bundle, not the server — so a build for Capacitor sets
 * `VITE_API_BASE_URL` to the deployed server's origin.
 *
 * The value is the origin alone (`https://duogrow.onrender.com`); `/api` is
 * appended here so callers cannot disagree about whether it was included.
 */
export function resolveApiBaseUrl(configuredOrigin: string | undefined): string {
  const origin = configuredOrigin?.trim()
  if (!origin) return API_PATH

  let parsed: URL
  try {
    parsed = new URL(origin)
  } catch {
    throw new Error(
      `VITE_API_BASE_URL is not a valid URL: ${JSON.stringify(origin)}. Expected an origin such as https://example.com`,
    )
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`VITE_API_BASE_URL must be http or https, got ${parsed.protocol}`)
  }

  // Rejected loudly rather than trimmed. A silently "corrected" value would send
  // every request somewhere the developer did not write, and the resulting 404s
  // would look like a server fault rather than a build-configuration mistake.
  if (parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error(
      `VITE_API_BASE_URL must be an origin with no path, query or fragment, got ${JSON.stringify(origin)}`,
    )
  }

  return `${parsed.protocol}//${parsed.host}${API_PATH}`
}
