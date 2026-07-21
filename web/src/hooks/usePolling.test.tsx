import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { usePolling } from './usePolling'

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason: Error) => void
}

function deferred<T>(): Deferred<T> {
  let resolve: ((value: T) => void) | undefined
  let reject: ((reason: Error) => void) | undefined
  const promise = new Promise<T>((complete, fail) => {
    resolve = complete
    reject = fail
  })

  return {
    promise,
    resolve: (value) => resolve?.(value),
    reject: (reason) => reject?.(reason),
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('usePolling', () => {
  it('does not overlap pending polling requests', async () => {
    vi.useFakeTimers()
    const first = deferred<string>()
    const fetcher = vi.fn().mockReturnValue(first.promise)
    renderHook(() => usePolling(fetcher, 3_000))

    expect(fetcher).toHaveBeenCalledTimes(1)

    act(() => {
      vi.advanceTimersByTime(9_000)
    })

    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('queues a manual refetch after a pending poll and resolves with a fresh response', async () => {
    const first = deferred<string>()
    const second = deferred<string>()
    const fetcher = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const { result } = renderHook(() => usePolling(fetcher, 60_000))

    expect(fetcher).toHaveBeenCalledTimes(1)

    let refreshComplete = false
    let refresh: Promise<void> | undefined

    act(() => {
      refresh = result.current.refetch().then(() => {
        refreshComplete = true
      })
    })

    expect(fetcher).toHaveBeenCalledTimes(1)

    await act(async () => {
      first.resolve('poll response')
      await first.promise
      await Promise.resolve()
    })

    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(refreshComplete).toBe(false)

    await act(async () => {
      second.resolve('fresh response')
      await refresh
    })

    expect(refreshComplete).toBe(true)
    expect(result.current).toMatchObject({ data: 'fresh response', error: null, isLoading: false })
  })
})
