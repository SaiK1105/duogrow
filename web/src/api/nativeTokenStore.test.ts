import { beforeEach, describe, expect, it, vi } from 'vitest'

const preferences = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
}))

vi.mock('@capacitor/preferences', () => ({ Preferences: preferences }))

const { capacitorTokenStore } = await import('./nativeTokenStore')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('capacitorTokenStore', () => {
  it('reads the token Capacitor persisted under the shared key', async () => {
    preferences.get.mockResolvedValue({ value: 'persisted-token' })

    await expect(capacitorTokenStore.load()).resolves.toBe('persisted-token')
    expect(preferences.get).toHaveBeenCalledWith({ key: 'duogrow.session' })
  })

  it('normalises a missing entry to null rather than undefined', async () => {
    // Capacitor returns { value: null } for an absent key; guard the undefined
    // case too so the store never hands back undefined as if it were a token.
    preferences.get.mockResolvedValue({ value: null })
    await expect(capacitorTokenStore.load()).resolves.toBeNull()

    preferences.get.mockResolvedValue({})
    await expect(capacitorTokenStore.load()).resolves.toBeNull()
  })

  it('writes and removes through the same key it reads', async () => {
    preferences.set.mockResolvedValue(undefined)
    preferences.remove.mockResolvedValue(undefined)

    await capacitorTokenStore.save('new-token')
    expect(preferences.set).toHaveBeenCalledWith({ key: 'duogrow.session', value: 'new-token' })

    await capacitorTokenStore.clear()
    expect(preferences.remove).toHaveBeenCalledWith({ key: 'duogrow.session' })
  })

  it('propagates a storage failure so tokenStore can report it', async () => {
    preferences.set.mockRejectedValue(new Error('no space left'))
    await expect(capacitorTokenStore.save('doomed')).rejects.toThrow('no space left')
  })
})
