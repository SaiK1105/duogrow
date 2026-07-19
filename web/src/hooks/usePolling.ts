import { useCallback, useEffect, useRef, useState } from 'react'

interface PollingState<T> {
  data: T | null
  error: Error | null
  isLoading: boolean
  refetch: () => Promise<void>
}

const DEFAULT_INTERVAL = 3000

/**
 * Poll a fetcher on an interval. Pauses while the tab is hidden (and refetches
 * on the way back), and exposes refetch() for immediate refresh after mutations.
 */
export function usePolling<T>(
  fetcher: () => Promise<T>,
  intervalMs: number = DEFAULT_INTERVAL,
  enabled: boolean = true,
): PollingState<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // Keep the latest fetcher without retriggering the effect on every render.
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const isMountedRef = useRef(true)

  const refetch = useCallback(async () => {
    try {
      const result = await fetcherRef.current()
      if (!isMountedRef.current) return
      setData(result)
      setError(null)
    } catch (err) {
      if (!isMountedRef.current) return
      setError(err instanceof Error ? err : new Error('Request failed'))
    } finally {
      if (isMountedRef.current) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!enabled) return

    let timer: number | undefined

    const tick = () => {
      if (!document.hidden) void refetch()
    }

    // Prime immediately, then poll.
    void refetch()
    timer = window.setInterval(tick, intervalMs)

    const onVisibility = () => {
      if (!document.hidden) void refetch()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      if (timer !== undefined) window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [enabled, intervalMs, refetch])

  return { data, error, isLoading, refetch }
}
