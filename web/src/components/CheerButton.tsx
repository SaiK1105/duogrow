import { useState } from 'react'
import './cheer-button.css'

interface CheerButtonProps {
  onCheer: () => void | Promise<void>
  label?: string
}

const PARTICLES = Array.from({ length: 10 }, (_, i) => i)

export function CheerButton({ onCheer, label = 'Cheer Partner' }: CheerButtonProps) {
  const [bursts, setBursts] = useState<number[]>([])

  const handle = () => {
    const id = Date.now()
    setBursts((prev) => [...prev, id])
    window.setTimeout(() => {
      setBursts((prev) => prev.filter((b) => b !== id))
    }, 750)
    void onCheer()
  }

  return (
    <button type="button" className="btn btn--ghost cheer-btn" onClick={handle}>
      <span className="cheer-btn__emoji" aria-hidden="true">
        🎉
      </span>
      <span>{label}</span>
      {bursts.map((b) => (
        <span key={b} className="cheer-burst" aria-hidden="true">
          {PARTICLES.map((p) => (
            <span
              key={p}
              className="cheer-particle"
              style={
                {
                  '--angle': `${(360 / PARTICLES.length) * p}deg`,
                } as React.CSSProperties
              }
            />
          ))}
        </span>
      ))}
    </button>
  )
}
