import { useEffect, useRef, useState } from 'react'

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(REDUCED_MOTION).matches
  )
}

/**
 * Animate a number from 0 → target over a duration on mount / when target
 * changes. Respects prefers-reduced-motion by snapping to the target.
 */
export function useCountUp(target: number, durationMs = 1000, startDelay = 0): number {
  const [value, setValue] = useState(prefersReducedMotion() ? target : 0)
  const frameRef = useRef<number | undefined>(undefined)
  const timeoutRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (prefersReducedMotion()) {
      setValue(target)
      return
    }

    const run = () => {
      const start = performance.now()
      const from = 0

      const step = (now: number) => {
        const elapsed = now - start
        const t = Math.min(1, elapsed / durationMs)
        // easeOutExpo
        const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
        setValue(from + (target - from) * eased)
        if (t < 1) frameRef.current = requestAnimationFrame(step)
        else setValue(target)
      }

      frameRef.current = requestAnimationFrame(step)
    }

    if (startDelay > 0) {
      timeoutRef.current = window.setTimeout(run, startDelay)
    } else {
      run()
    }

    return () => {
      if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current)
      if (timeoutRef.current !== undefined) window.clearTimeout(timeoutRef.current)
    }
  }, [target, durationMs, startDelay])

  return value
}
