import { useEffect, useRef, useState } from 'react'
import { useCountUp } from '../hooks/useCountUp'
import './duo-progress-bar.css'

interface DuoProgressBarProps {
  duoProgress: number
  youPercent: number
  partnerPercent: number
  youName: string
  partnerName: string
}

interface FillRowProps {
  name: string
  percent: number
  tone: 'you' | 'partner'
}

function FillRow({ name, percent, tone }: FillRowProps) {
  const pct = Math.max(0, Math.min(100, percent))
  const [filled, setFilled] = useState(false)
  const timerRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    timerRef.current = window.setTimeout(() => setFilled(true), 80)
    return () => {
      if (timerRef.current !== undefined) window.clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <div className="duobar__row">
      <span className="duobar__name">{name}</span>
      <div className="duobar__track">
        <span
          className={`duobar__fill duobar__fill--${tone} ${pct >= 100 ? 'is-complete' : ''}`}
          style={{ transform: `scaleX(${filled ? pct / 100 : 0})` }}
        />
      </div>
      <span className="duobar__pct">{Math.round(pct)}%</span>
    </div>
  )
}

export function DuoProgressBar({
  duoProgress,
  youPercent,
  partnerPercent,
  youName,
  partnerName,
}: DuoProgressBarProps) {
  const shown = useCountUp(duoProgress, 1000)

  return (
    <section className="duobar" aria-label="Duo progress">
      <header className="duobar__head">
        <div>
          <span className="duobar__eyebrow">Duo progress today</span>
          <span className="duobar__hint">Braid it to 100% together</span>
        </div>
        <span className="duobar__big">{Math.round(shown)}%</span>
      </header>
      <div className="duobar__rows">
        <FillRow name={youName} percent={youPercent} tone="you" />
        <FillRow name={partnerName} percent={partnerPercent} tone="partner" />
      </div>
    </section>
  )
}
