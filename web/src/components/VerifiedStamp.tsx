import type { Band } from '../api/types'
import './verified-stamp.css'

interface VerifiedStampProps {
  band: Band
  size?: number
}

// Inner glyph per confidence tier.
function Glyph({ band }: { band: Band }) {
  if (band === 'high') {
    return (
      <path
        className="stamp__glyph"
        d="M23 37 32 46 49 27"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    )
  }
  if (band === 'medium') {
    return (
      <path
        className="stamp__glyph"
        d="M30 26a6 6 0 1 1 7 6c-1.6.7-2.8 2-2.8 4v1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    )
  }
  return (
    <path
      className="stamp__glyph"
      d="M27 27 45 45M45 27 27 45"
      fill="none"
      stroke="currentColor"
      strokeWidth="5"
      strokeLinecap="round"
    />
  )
}

export function VerifiedStamp({ band, size = 88 }: VerifiedStampProps) {
  const r = 34
  const circumference = 2 * Math.PI * r

  return (
    <span className={`stamp stamp--${band}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 72 72" width={size} height={size} className="stamp__svg">
        <circle cx="36" cy="36" r={r} className="stamp__halo" />
        <circle
          cx="36"
          cy="36"
          r={r}
          className="stamp__ring"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
          transform="rotate(-90 36 36)"
        />
        {band === 'medium' && (
          <circle cx="35.5" cy="49" r="2.2" fill="currentColor" className="stamp__glyph-dot" />
        )}
        <Glyph band={band} />
      </svg>
    </span>
  )
}
