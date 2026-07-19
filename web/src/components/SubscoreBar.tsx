import { useEffect, useRef, useState } from 'react'
import './subscore-bar.css'

interface SubscoreBarProps {
  label: string
  value: number
  max?: number
  color?: string
  delayMs?: number
}

export function SubscoreBar({
  label,
  value,
  max = 100,
  color = 'var(--accent-500)',
  delayMs = 0,
}: SubscoreBarProps) {
  const pct = Math.max(0, Math.min(1, value / max))
  const [filled, setFilled] = useState(false)
  const timerRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    timerRef.current = window.setTimeout(() => setFilled(true), delayMs + 60)
    return () => {
      if (timerRef.current !== undefined) window.clearTimeout(timerRef.current)
    }
  }, [delayMs])

  return (
    <div className="subscore">
      <div className="subscore__head">
        <span className="subscore__label">{label}</span>
        <span className="subscore__value">{Math.round(value)}</span>
      </div>
      <div className="subscore__track">
        <span
          className="subscore__fill"
          style={{
            transform: `scaleX(${filled ? pct : 0})`,
            background: color,
          }}
        />
      </div>
    </div>
  )
}
