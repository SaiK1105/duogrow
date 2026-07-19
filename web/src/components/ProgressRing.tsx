import { useEffect, useRef, useState } from 'react'
import { useCountUp } from '../hooks/useCountUp'
import './progress-ring.css'

interface ProgressRingProps {
  value: number
  max?: number
  size?: number
  strokeWidth?: number
  /** CSS color / var for the arc. Defaults to accent green. */
  color?: string
  trackColor?: string
  label?: string
  showValue?: boolean
  suffix?: string
  durationMs?: number
}

/**
 * SVG progress ring. The arc animates via stroke-dashoffset (paint-only, the
 * one flagged exception in the motion budget) and the center number counts up.
 */
export function ProgressRing({
  value,
  max = 100,
  size = 168,
  strokeWidth = 12,
  color = 'var(--accent-500)',
  trackColor = 'var(--surface-highlight)',
  label,
  showValue = true,
  suffix = '',
  durationMs = 1100,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const pct = Math.max(0, Math.min(1, value / max))

  const [mounted, setMounted] = useState(false)
  const rafRef = useRef<number | undefined>(undefined)
  useEffect(() => {
    rafRef.current = requestAnimationFrame(() => setMounted(true))
    return () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const displayValue = useCountUp(value, durationMs)
  const dashoffset = mounted ? circumference * (1 - pct) : circumference

  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="ring__svg">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        <circle
          className="ring__arc"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashoffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: `stroke-dashoffset ${durationMs}ms var(--ease-out-expo)` }}
        />
      </svg>
      {showValue && (
        <div className="ring__center">
          <span className="ring__value">
            {Math.round(displayValue)}
            {suffix}
          </span>
          {label && <span className="ring__label">{label}</span>}
        </div>
      )}
    </div>
  )
}
