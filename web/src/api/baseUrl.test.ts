import { describe, expect, it } from 'vitest'
import { resolveApiBaseUrl } from './baseUrl'

describe('web builds', () => {
  it('stays relative when nothing is configured, keeping production single-origin', () => {
    expect(resolveApiBaseUrl(undefined)).toBe('/api')
    expect(resolveApiBaseUrl('')).toBe('/api')
    expect(resolveApiBaseUrl('   ')).toBe('/api')
  })
})

describe('native builds', () => {
  it('appends /api to a configured origin so callers cannot disagree about it', () => {
    expect(resolveApiBaseUrl('https://duogrow.onrender.com')).toBe('https://duogrow.onrender.com/api')
  })

  it('keeps an explicit port', () => {
    expect(resolveApiBaseUrl('http://192.168.1.10:8787')).toBe('http://192.168.1.10:8787/api')
  })

  it('tolerates surrounding whitespace from a .env file', () => {
    expect(resolveApiBaseUrl('  https://example.com  ')).toBe('https://example.com/api')
  })
})

describe('misconfiguration fails loudly', () => {
  it('rejects a value that is not a URL', () => {
    expect(() => resolveApiBaseUrl('duogrow.onrender.com')).toThrow(/not a valid URL/)
  })

  it('rejects a non-http scheme', () => {
    expect(() => resolveApiBaseUrl('capacitor://localhost')).toThrow(/must be http or https/)
  })

  it('rejects an origin carrying a path, so requests cannot silently go elsewhere', () => {
    expect(() => resolveApiBaseUrl('https://example.com/api')).toThrow(/no path, query or fragment/)
    expect(() => resolveApiBaseUrl('https://example.com/')).not.toThrow()
    expect(() => resolveApiBaseUrl('https://example.com?x=1')).toThrow(/no path, query or fragment/)
  })

  it('accepts a bare trailing slash, which is the same origin', () => {
    expect(resolveApiBaseUrl('https://example.com/')).toBe('https://example.com/api')
  })
})
