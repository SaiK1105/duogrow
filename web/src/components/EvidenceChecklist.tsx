import type { Band } from '../api/types'
import './evidence-checklist.css'

interface EvidenceChecklistProps {
  items: string[]
  band: Band
}

const STAGGER_MS = 40

export function EvidenceChecklist({ items, band }: EvidenceChecklistProps) {
  const muted = band === 'low'
  return (
    <ul className={`evidence evidence--${band}`}>
      {items.map((item, i) => (
        <li
          key={`${i}-${item}`}
          className="evidence__row"
          style={{ animationDelay: `${i * STAGGER_MS}ms` }}
        >
          <span className="evidence__mark" aria-hidden="true">
            {muted ? (
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path
                  d="M6 12h12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path
                  className="evidence__check"
                  d="M5 12.5 10 17.5 19 7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </span>
          <span className="evidence__text">{item}</span>
        </li>
      ))}
    </ul>
  )
}
