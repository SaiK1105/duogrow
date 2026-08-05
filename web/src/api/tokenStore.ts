const TOKEN_KEY = 'duogrow.session'

/**
 * Where the session token is persisted between page loads or app launches.
 *
 * This is async because native storage is: Capacitor's Preferences API returns
 * promises. The store keeps a synchronous in-memory cache on top so callers —
 * every API request builds an auth header — stay synchronous.
 */
export interface PersistentTokenStore {
  load(): Promise<string | null>
  save(token: string): Promise<void>
  clear(): Promise<void>
}

/**
 * Web default: sessionStorage, and deliberately so. Per-tab sessions are a
 * feature here — two tabs are two users, which is how a duo is demonstrated in
 * one browser.
 *
 * A native shell must NOT use this. A webview's sessionStorage is discarded
 * when the webview is torn down, so every app relaunch would sign the person
 * out. Phase 3 registers a Capacitor-backed store instead.
 */
export const sessionStorageTokenStore: PersistentTokenStore = {
  async load() {
    return sessionStorage.getItem(TOKEN_KEY)
  },
  async save(token: string) {
    sessionStorage.setItem(TOKEN_KEY, token)
  },
  async clear() {
    sessionStorage.removeItem(TOKEN_KEY)
  },
}

let store: PersistentTokenStore = sessionStorageTokenStore
let cachedToken: string | null = null
let isHydrated = false

/**
 * A persistence failure is never silent. On native it means the person is
 * signed in now but will be signed out on next launch, with nothing on screen
 * explaining why — the least debuggable class of bug this store can produce.
 */
function reportStoreFailure(operation: string, cause: unknown): void {
  console.error(`[tokenStore] ${operation} failed; the session may not survive a restart`, cause)
}

/** Swap in a platform store. Call before hydrateToken(). */
export function registerTokenStore(next: PersistentTokenStore): void {
  store = next
  isHydrated = false
}

/**
 * Load the persisted token into the synchronous cache. Must be awaited during
 * startup, before anything renders or fetches: until it resolves the cache is
 * empty, and an empty cache is indistinguishable from being signed out.
 */
export async function hydrateToken(): Promise<void> {
  try {
    cachedToken = await store.load()
  } catch (error) {
    cachedToken = null
    reportStoreFailure('load', error)
  } finally {
    isHydrated = true
  }
}

export function getToken(): string | null {
  if (!isHydrated) {
    reportStoreFailure('read', new Error('getToken() called before hydrateToken() resolved'))
  }
  return cachedToken
}

/**
 * Updates the cache synchronously so the very next request is authenticated,
 * then persists in the background. The write is not awaited because sign-in
 * should not block on disk, but a failure is still surfaced.
 */
export function setToken(token: string): void {
  cachedToken = token
  isHydrated = true
  void store.save(token).catch((error: unknown) => reportStoreFailure('save', error))
}

export function clearToken(): void {
  cachedToken = null
  isHydrated = true
  void store.clear().catch((error: unknown) => reportStoreFailure('clear', error))
}

/** Restores module state between tests. Not for application code. */
export function resetTokenStoreForTests(): void {
  store = sessionStorageTokenStore
  cachedToken = null
  isHydrated = false
}
