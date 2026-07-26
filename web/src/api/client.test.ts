import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, clearToken, setToken } from './client'

afterEach(() => {
  clearToken()
  vi.unstubAllGlobals()
})

describe('AI API errors', () => {
  it('preserves structured AI limit reason and retry metadata', async () => {
    setToken('test-session')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: 'AI request limit reached',
      reason: 'feature_quota',
      retry: 'next_week',
    }), { status: 429, headers: { 'content-type': 'application/json' } })))

    await expect(api.duoReflection()).rejects.toMatchObject({
      message: 'AI request limit reached',
      status: 429,
      reason: 'feature_quota',
      retry: 'next_week',
    })
  })
})
