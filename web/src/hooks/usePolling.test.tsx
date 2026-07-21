import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { usePolling } from './usePolling'

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
}

function deferred<T>(): Deferred<T> {
  let resolve: ((value: T) => void) | undefined
  const promise = new Promise<T>((complete) => {
    resolve = complete
  })

  return { promise, resolve: (value) => resolve?.(value) }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('usePolling', () => {
  it('retains the newest response when an older request settles last', async () => {
    const first = deferred<string>()
    const second = deferred<string>()
    const fetcher = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const { result } = renderHook(() => usePolling(fetcher, 60_000))

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))

    act(() => {
      void result.current.refetch()
    })
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))

    await act(async () => {
      second.resolve('new response')
      await second.promise
    })
    expect(result.current.data).toBe('new response')

    await act(async () => {
      first.resolve('stale response')
      await first.promise
    })
    expect(result.current.data).toBe('new response')
  })
})
