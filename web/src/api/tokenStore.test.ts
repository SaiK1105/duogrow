import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearToken,
  getToken,
  hydrateToken,
  registerTokenStore,
  resetTokenStoreForTests,
  setToken,
  type PersistentTokenStore,
} from './tokenStore'

/** Stands in for Capacitor Preferences: persistent, and asynchronous. */
function fakeNativeStore(initial: string | null = null) {
  let persisted = initial
  const store: PersistentTokenStore & { readonly persisted: () => string | null } = {
    load: vi.fn(async () => persisted),
    save: vi.fn(async (token: string) => {
      persisted = token
    }),
    clear: vi.fn(async () => {
      persisted = null
    }),
    persisted: () => persisted,
  }
  return store
}

beforeEach(() => {
  resetTokenStoreForTests()
  sessionStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('web default', () => {
  it('round-trips a token through sessionStorage so two tabs stay two users', async () => {
    setToken('tab-a-token')
    await hydrateToken()

    expect(getToken()).toBe('tab-a-token')
    expect(sessionStorage.getItem('duogrow.session')).toBe('tab-a-token')
  })

  it('forgets the token on clear', async () => {
    setToken('doomed')
    clearToken()
    await hydrateToken()

    expect(getToken()).toBeNull()
    expect(sessionStorage.getItem('duogrow.session')).toBeNull()
  })
})

describe('a registered platform store', () => {
  it('restores a token persisted by a previous app launch', async () => {
    const native = fakeNativeStore('token-from-last-launch')
    registerTokenStore(native)

    // Before hydration the cache is empty; this is exactly the window in which a
    // signed-in person would be bounced to onboarding.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(getToken()).toBeNull()

    await hydrateToken()
    expect(getToken()).toBe('token-from-last-launch')
    expect(native.load).toHaveBeenCalledOnce()
  })

  it('authenticates the very next request without waiting for the write to land', () => {
    const native = fakeNativeStore()
    registerTokenStore(native)

    setToken('fresh-token')

    // Synchronously readable even though save() has not resolved.
    expect(getToken()).toBe('fresh-token')
    expect(native.save).toHaveBeenCalledWith('fresh-token')
  })

  it('persists across a simulated relaunch', async () => {
    const native = fakeNativeStore()
    registerTokenStore(native)
    setToken('survives')
    await vi.waitFor(() => expect(native.persisted()).toBe('survives'))

    // Relaunch: fresh module state, same underlying storage.
    resetTokenStoreForTests()
    registerTokenStore(native)
    await hydrateToken()

    expect(getToken()).toBe('survives')
  })
})

describe('failure reporting', () => {
  it('reports a failed load and signs the person out rather than crashing startup', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    registerTokenStore({
      load: async () => {
        throw new Error('storage unavailable')
      },
      save: async () => {},
      clear: async () => {},
    })

    await expect(hydrateToken()).resolves.toBeUndefined()
    expect(getToken()).toBeNull()
    expect(error).toHaveBeenCalled()
  })

  it('reports a failed save, because the session silently vanishes on next launch', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    registerTokenStore({
      load: async () => null,
      save: async () => {
        throw new Error('disk full')
      },
      clear: async () => {},
    })

    setToken('doomed')
    await vi.waitFor(() => expect(error).toHaveBeenCalled())
    // The in-memory session still works for this run.
    expect(getToken()).toBe('doomed')
  })

  it('reports a read that happens before hydration resolves', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    registerTokenStore(fakeNativeStore('unread'))

    getToken()

    expect(error).toHaveBeenCalled()
  })
})
